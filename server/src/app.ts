import { timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';
import { buildMessages, parseReply, resolveShortlist, SceneCache } from './scene';
import type { ChatJson } from './tokenstars';
import { Usage } from './usage';

export interface Deps {
  config: Config;
  chat: ChatJson;
  /** False when no TokenStars key or model is set: the route answers 503 and charges nothing. */
  aiReady?: boolean;
  usage?: Usage;
}

export async function buildServer({ config, chat, usage: givenUsage, aiReady = true }: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.LOG_LEVEL === 'silent'
        ? false
        : {
            level: config.LOG_LEVEL,
            // What visitors write never reaches the log (docs/01 P8), nor do invites.
            redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body', 'body'], censor: '[redacted]' },
          },
    // Believe X-Forwarded-For only from a proxy on this machine or network (as in yuha).
    trustProxy: 'loopback, linklocal, uniquelocal',
    bodyLimit: 16_384,
  });

  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS.length ? config.ALLOWED_ORIGINS : false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
  });
  await app.register(rateLimit, { global: false });

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

  const originAllowed = (origin: string | undefined) =>
    !config.ALLOWED_ORIGINS.length || (origin !== undefined && config.ALLOWED_ORIGINS.includes(origin));

  app.get('/api/health', async () => ({ ok: true }));

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

  return app;
}
