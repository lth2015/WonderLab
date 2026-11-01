import { timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAuthAdapter } from './auth/index.js';
import type { AppConfig } from './config.js';
import type { AppContext } from './context.js';
import { redactUrlSecrets } from './log-redaction.js';
import authPlugin from './plugins/auth.js';
import errorPlugin from './plugins/errors.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import billingRoutes from './routes/billing.js';
import publicRoutes from './routes/public.js';
import stablecoinRoutes from './routes/stablecoin.js';
import { buildMessages, parseReply, resolveShortlist, SceneCache } from './scene.js';
import { cleanLine, parseTalk, TalkBudget, talkMessages } from './edo-talk.js';
import type { ChatJson } from './tokenstars.js';
import { Usage } from './usage.js';
import { keepsRawBody } from './webhook-paths.js';
import { registerWeb } from './web.js';

export interface Deps {
  config: AppConfig;
  chat: ChatJson;
  /** False when no TokenStars key or model is set: the scene route answers 503 and charges nothing. */
  aiReady?: boolean;
  /** 江戸編の即興のひとこと (edo-talk.ts); absent or null: the route answers 503 and the app uses its script. */
  edoChat?: ChatJson | null;
  usage?: Usage;
  /** Accounts and payments (needs the database); null keeps only the scene proxy and public routes. */
  ctx?: AppContext | null;
}

export async function buildServer({ config, chat, usage: givenUsage, aiReady = true, ctx = null, edoChat = null }: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : {
            level: config.LOG_LEVEL,
            // What visitors write never reaches the log (docs/01 P8), nor do
            // tokens, cookies or signatures (yuha SEC-06).
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["stripe-signature"]',
                'req.body',
                'body',
                '*.apiKey',
                '*.secret',
              ],
              censor: '[redacted]',
            },
            serializers: {
              req(request: { method: string; url: string; id?: unknown }) {
                return { method: request.method, url: redactUrlSecrets(request.url), id: request.id };
              },
            },
          },
    // Believe X-Forwarded-For only from a proxy on this machine or network; see
    // yuha's server.ts for why `true` let a forged header defeat every per-IP limit.
    trustProxy: 'loopback, linklocal, uniquelocal',
    bodyLimit: 1_000_000,
  });

  const origins = [config.PUBLIC_WEB_URL, ...config.ALLOWED_ORIGINS];

  await app.register(errorPlugin, { servesWeb: !!config.WEB_DIST_DIR });
  if (config.WEB_DIST_DIR) await registerWeb(app, config.WEB_DIST_DIR);
  await app.register(cors, {
    origin: origins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key'],
  });
  await app.register(rateLimit, { global: false, max: 300, timeWindow: '1 minute' });

  /**
   * Stripe signature verification needs the exact bytes that were sent, so the
   * webhook routes keep their raw body (yuha PAY-04); every other JSON route
   * is parsed. Which paths those are is `webhook-paths.ts`'s to say.
   */
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body: Buffer, done) => {
    if (keepsRawBody(req.routeOptions?.url ?? undefined)) {
      done(null, body);
      return;
    }
    if (body.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch (err) {
      (err as { statusCode?: number }).statusCode = 400;
      done(err as Error, undefined);
    }
  });

  app.get('/api/health', async () => ({ ok: true, accounts: !!ctx }));
  await app.register(publicRoutes, { config, ctx });

  if (ctx) {
    const adapter = createAuthAdapter(config);
    await app.register(authPlugin, { adapter, adminMfaRequired: config.ADMIN_MFA_REQUIRED });
    await app.register(authRoutes, { ctx, adapter });
    await app.register(billingRoutes, { ctx });
    await app.register(stablecoinRoutes, { ctx });
    await app.register(adminRoutes, { ctx });
  }

  // ---------------------------------------------------------------- 一句成境
  const usage =
    givenUsage ??
    new Usage(
      {
        dailyPerInvite: config.SCENE_DAILY_PER_INVITE,
        dailyBudget: config.SCENE_DAILY_BUDGET_JPY,
        totalBudget: config.SCENE_TOTAL_BUDGET_JPY,
        costPerCall: config.TOKENSTARS_COST_MINOR_PER_REQUEST,
      },
      config.NODE_ENV === 'test' ? null : config.USAGE_FILE,
    );
  const cache = new SceneCache(config.SCENE_CACHE_SALT, config.SCENE_CACHE_TTL_HOURS * 3600_000);
  const invites = config.INVITE_TOKENS.map((t) => Buffer.from(t));

  const inviteOf = (header: string | undefined): string | null => {
    const m = /^Invite (\S{8,200})$/.exec(header ?? '');
    if (!m) return null;
    const given = Buffer.from(m[1]);
    return invites.some((t) => t.length === given.length && timingSafeEqual(t, given)) ? m[1] : null;
  };

  // A browser always sends Origin on this POST; the check refuses other sites.
  // Same-origin tools without one (curl in development) are let through.
  const originAllowed = (origin: string | undefined) => origin === undefined || origins.includes(origin);


  app.post(
    '/api/scene',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!originAllowed(req.headers.origin)) return reply.code(403).send({ error: 'origin' });
      const invite = inviteOf(req.headers.authorization);
      if (!invite) return reply.code(401).send({ error: 'invite' });
      if (!aiReady) return reply.code(503).send({ error: 'off' });

      const body = req.body as { text?: unknown; shortlist?: unknown } | undefined;
      const text = typeof body?.text === 'string' ? [...body.text.trim()].slice(0, 50).join('') : '';
      const shortlist = resolveShortlist(body?.shortlist);
      if (!text || !shortlist.length) return reply.code(400).send({ error: 'input' });
      const ids = shortlist.map((p) => p.id);

      const key = cache.key(text, ids);
      const cached = cache.get(key);
      if (cached) return { ...cached, cached: true };

      const charge = usage.charge(invite);
      if (!charge.ok) {
        req.log.warn({ cap: charge.reason }, 'scene cap reached');
        return reply.code(429).send({ error: 'limited' });
      }

      const res = await chat(buildMessages(text, shortlist), { maxTokens: 120, temperature: 0.4, timeoutMs: config.SCENE_TIMEOUT_MS });
      if (res.status !== 'ok') {
        req.log.warn({ code: res.code, status: res.status }, 'scene model call did not answer');
        return reply.code(res.status === 'refused' ? 422 : 502).send({ error: res.status });
      }
      const out = parseReply(res.value, ids);
      cache.set(key, out);
      return out;
    },
  );

  // ---------------------------------------------------------------- 江戸編：即興のひとこと
  const talkBudget = new TalkBudget(config.EDO_TALK_PER_VISITOR, config.EDO_TALK_DAILY);
  app.post(
    '/api/edo/talk',
    { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!originAllowed(req.headers.origin)) return reply.code(403).send({ error: 'origin' });
      if (!edoChat) return reply.code(503).send({ error: 'off' });
      const t = parseTalk(req.body);
      if (!t) return reply.code(400).send({ error: 'input' });
      if (!talkBudget.take(req.ip)) return reply.code(429).send({ error: 'limited' });
      const res = await edoChat(talkMessages(t.who, t.topic, t.done, t.turn), { maxTokens: 900, temperature: null, timeoutMs: config.EDO_TALK_TIMEOUT_MS });
      if (res.status !== 'ok') {
        req.log.warn({ code: res.code, status: res.status }, 'edo talk did not answer');
        return reply.code(502).send({ error: res.status });
      }
      const line = cleanLine(res.value);
      if (!line) return reply.code(502).send({ error: 'unfit' });
      return { line };
    },
  );

  return app;
}
