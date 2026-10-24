import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { GOOGLE_CALLBACK_PATH, GOOGLE_WEB_RETURN_PATH } from './auth/google-paths.js';
import { RunMode } from '@wonderlab/contracts';
import { parseCatalogue, type CatalogueRow } from './catalogue.js';

/**
 * Configuration and mode validation, ported from yuha (apps/api/src/config.ts,
 * Apache-2.0). Kept: run modes, identity, payments, stablecoin, purchase caps
 * and card review, with yuha's start-up checks. Cut: music, storage, queues,
 * email, lyric alignment and generation tuning, which WonderLab does not
 * have. Added: the 一句成境 settings (invites and the three AI caps).
 *
 * The central rule, from yuha: a run mode is a single explicit value, and the
 * adapter selection must be *consistent* with it. `loadConfig` derives the
 * adapters from the mode and refuses to start when a combination is illegal —
 * a development login or simulated payments in production (SEC-03), or a live
 * Stripe key outside production.
 *
 * Accounts and payments need a database. Without DATABASE_URL the server still
 * starts and serves the scene proxy; the account and payment routes are off.
 */

/**
 * An empty value in a .env file means "not set", the same way `bool` already
 * treats it.
 *
 * `z.coerce.number()` does not: Number('') is 0, so a variable left blank
 * became zero and then failed a `.positive()` check with a message about the
 * number being too small — for a line the author had deliberately left empty
 * to take the default. A blank line in a config file is the most ordinary
 * thing there is, and it should not be an error about arithmetic.
 */
/*
 * Trimmed, because `Number(' ')` is 0.
 *
 * A line left as `KEY= ` — a space after the equals, which editors and shell
 * heredocs produce without anybody meaning anything by it — is as empty as a
 * line with nothing after it, and reading it as zero is the same defect this
 * helper exists to fix, one character further on.
 */
const blank = (v: string | undefined) => v === undefined || v.trim() === '';

/**
 * The oldest Stripe API version this code is written for.
 *
 * Two separate reasons, both discovered the expensive way: an account with
 * Managed Payments refuses a Checkout Session on anything older, and the
 * webhook payload shape this version introduced is what
 * `services/webhooks.ts` reads — an Invoice's subscription under
 * `parent.subscription_details`, a Subscription's period on its items.
 */
export const STRIPE_API_VERSION_FLOOR = '2025-03-31.basil';

const num = (dflt: number) =>
  z
    .string()
    .optional()
    .transform((v) => (blank(v) ? dflt : Number(v!.trim())))
    .pipe(z.number().int());

const optionalNum = () =>
  z
    .string()
    .optional()
    .transform((v) => (blank(v) ? undefined : Number(v!.trim())))
    .pipe(z.number().int().min(0).optional());

const bool = (dflt: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? dflt : v === 'true' || v === '1'));

/**
 * An optional secret. A blank one is absent, not empty.
 *
 * `.env` carried `GOOGLE_SESSION_SECRET=` — the key written, the value not —
 * and the fallback meant to cover that is
 * `cfg.GOOGLE_SESSION_SECRET ?? cfg.DEV_AUTH_SECRET`. `??` does not catch the
 * empty string, so the effective session signing key was `''`: every
 * Google-issued session signed with an empty secret, forgeable by anyone who
 * knows the token format. The storage signer has the same shape, where an
 * empty key means a download URL for any object can be minted.
 *
 * `bool` and `int` above already treat `''` as unset; plain `z.string()
 * .optional()` did not, so the two kinds of setting disagreed about what a
 * blank line in a .env file means. Whitespace counts as blank too — a key
 * someone "filled in" with a space is the same mistake wearing a coat.
 *
 * Production was never exposed: those checks use `!`, which does catch `''`,
 * and refuse to start. Every other environment was.
 */
const secret = () =>
  z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    });

const int = (dflt: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? dflt : Number.parseInt(v, 10)))
    .pipe(z.number().int());


const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
const decimal = (dflt: number) =>
  z
    .string()
    .optional()
    .transform((v) => (blank(v) ? dflt : Number(v!.trim())))
    .pipe(z.number().nonnegative());

const envSchema = z.object({
  RUN_MODE: RunMode.default('demo'),
  NODE_ENV: z.string().default('development'),
  PORT: int(8787),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:8787'),
  /**
   * The built web app (npm run build → dist) to serve from this same origin,
   * for a one-process deployment. Unset: the API serves no pages.
   */
  WEB_DIST_DIR: z.string().optional(),
  /** Extra web origins allowed to call the API, comma separated (PUBLIC_WEB_URL always is). */
  ALLOWED_ORIGINS: csv,

  /** Accounts and payments are off without it; the scene proxy works either way. */
  DATABASE_URL: secret(),
  DATABASE_POOL_MAX: int(10),
  DATABASE_SSL: bool(false),
  /** Run the webhook, chain-scan and maintenance loops in this process. */
  RUN_WORKER: bool(true),

  // --- identity -----------------------------------------------------------
  AUTH_ADAPTER: z.enum(['dev', 'google']).optional(),
  /** Signing secret for the local dev session token. Never valid in production. */
  DEV_AUTH_SECRET: secret(),
  /** Restricts the dev sign-in; see auth/allowlist.ts. Empty = unrestricted. */
  DEV_LOGIN_ALLOWLIST: z.string().optional(),
  /** "Sign in with Google" (authorization code + PKCE; see auth/google.ts). */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: secret(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  /** Signing secret for Google-issued sessions; falls back to DEV_AUTH_SECRET outside production. */
  GOOGLE_SESSION_SECRET: secret(),
  /** Key material for encrypting TOTP secrets at rest. Falls back outside production. */
  MFA_ENCRYPTION_SECRET: secret(),
  /** Issuer shown in Google Authenticator. */
  MFA_ISSUER: z.string().default('WonderLab'),
  /*
   * Staff accounts must carry a second factor (yuha). An operations console
   * can decide held orders and stablecoin payments, so a stolen staff
   * password is a different class of incident from a stolen customer one.
   * Default on, and production refuses to start with it off.
   */
  ADMIN_MFA_REQUIRED: bool(true),

  /*
   * Stablecoin payments. Three switches, all off, and they stay off until the
   * business conclusions in docs/STABLECOIN_V1_PLAN.md are in hand — turning
   * one on is a decision about licensing, tax and terms, not a deployment
   * detail. Each currency has its own switch because JPYC and USDC differ in
   * what still has to be confirmed about them.
   *
   * Turning a switch OFF must not stop the scanner, pending fulfilment or
   * refunds; it closes the door to NEW payments only.
   */
  STABLECOIN_ENABLED: bool(false),
  STABLECOIN_JPYC_ENABLED: bool(false),
  STABLECOIN_USDC_ENABLED: bool(false),
  // Emergency opt-in: trust the secondary provider alone for every chain read.
  // The default still requires two independent providers to agree.
  STABLECOIN_RPC_MODE: z.enum(['dual', 'single_secondary']).default('dual'),
  STABLECOIN_CHAIN_ID: num(137).pipe(z.number().int().positive()),
  STABLECOIN_RECEIVER_ADDRESS: z.string().optional(),
  /*
   * Two nodes, from two different companies.
   *
   * Two endpoints from one provider usually share a cluster and a view of the
   * chain, so "the nodes disagree" could never be true and the check that
   * rests on it would be a formality. Config cannot tell whose endpoint a URL
   * is, so this is enforced by the person setting it and written down in
   * docs/STABLECOIN_V1_PLAN.md — but identical URLs it CAN catch, and does.
   *
   * Secrets: they carry an API key. They belong in the deployment's secret
   * store and in a local .env, never in git.
   */
  POLYGON_RPC_PRIMARY_URL: z.string().optional(),
  POLYGON_RPC_SECONDARY_URL: z.string().optional(),
  /*
   * How far below the finalized head one eth_getLogs call may reach, and how
   * many blocks each pass re-reads.
   *
   * The span default is 450 rather than a round 500 because providers cap
   * eth_getLogs ranges and the caps differ by plan — one entry plan publishes
   * 500 — so the default has to sit below the lower of the two in use. Set it
   * from the actual caps once both providers are known.
   */
  STABLECOIN_SCAN_MAX_SPAN: num(450).pipe(z.number().int().min(1).max(10_000)),
  STABLECOIN_SCAN_OVERLAP: num(32).pipe(z.number().int().min(0).max(1_000)),
  STABLECOIN_SCAN_START_BLOCK: optionalNum(),
  STABLECOIN_QUOTE_TTL_SECONDS: num(600).pipe(z.number().int().min(60).max(3600)),
  /*
   * USDC pricing. One USDC is priced as one US dollar (product decision,
   * 2026-10-20) and converted from the JPY list price at USD/JPY, read from
   * two independent sources — see packages/providers/src/fx/usd-jpy.ts.
   *
   *   BUFFER_BPS             added on top for the rate moving while a quote is
   *                          open. 100 = 1%, the agreed default. Stored on
   *                          every quote, so changing it never re-prices one.
   *   MAX_DIVERGENCE_BPS     how far the intraday primary may sit from the daily
   *                          reference before quoting stops. The reference is a
   *                          day old by design, so this is a broken-feed guard,
   *                          not a precision claim.
   *   REFERENCE_MAX_AGE_HOURS how old the reference's own publication date may
   *                          be. 96 covers a weekend plus a holiday.
   */
  STABLECOIN_USDC_BUFFER_BPS: num(100).pipe(z.number().int().min(0).max(1000)),
  STABLECOIN_RATE_MAX_DIVERGENCE_BPS: num(300).pipe(z.number().int().min(1).max(2000)),
  STABLECOIN_RATE_REFERENCE_MAX_AGE_HOURS: num(96).pipe(z.number().int().min(1).max(336)),
  /*
   * How long after a quote expires its payment slot is still held.
   *
   * Not a courtesy. A payment is only SEEN once its block is finalized and the
   * next scan pass reads it, so a payment made inside the quote window is
   * routinely first observed a minute or two after the window closed. Closing
   * the intent on the deadline turned those on-time payments into money from a
   * wallet with nothing open — paid in time, nothing delivered, no automatic
   * repair. The floor is finality plus one scan interval; the default is fifteen
   * minutes, because the cost of waiting is a held wallet slot and the cost of
   * not waiting is somebody's money.
   */
  STABLECOIN_INTENT_GRACE_SECONDS: num(900).pipe(z.number().int().min(60).max(86_400)),
  /*
   * The whitelist/receiver/rule version stamped onto every quote. Bump it when
   * any of those change, so an existing order keeps being verified against the
   * rules it was quoted under.
   */
  STABLECOIN_CONFIG_VERSION: num(1).pipe(z.number().int().positive()),

  // --- payments -----------------------------------------------------------
  PAYMENTS_ADAPTER: z.enum(['simulated', 'stripe']).optional(),
  STRIPE_SECRET_KEY: secret(),
  STRIPE_WEBHOOK_SECRET: secret(),
  STRIPE_PUBLISHABLE_KEY: secret(),
  /**
   * The Stripe API version every request and every webhook payload is pinned
   * to. Checked for shape and floor against `STRIPE_API_VERSION_FLOOR`. Required in production — see the check in `validate`. Unset falls back
   * to whatever the installed SDK pins, which is a dependency bump away from
   * changing the shape of live events.
   */
  STRIPE_API_VERSION: z.string().optional(),
  /**
   * QR wallets (Alipay, WeChat Pay) on one-time checkouts.
   *
   * Off unless asked for: both must be enabled on the Stripe account first,
   * and listing a method the account cannot take fails at the checkout page
   * rather than at boot. They are single-use methods, so they are never
   * offered for subscriptions — Stripe rejects the session outright.
   */
  STRIPE_WALLETS_ENABLED: bool(false),
  /**
   * What WonderLab sells. Undecided by the founder, so nothing is hard-coded:
   * a JSON array of products (see catalogue.ts and .env.example). Each
   * product's Stripe price id is read from STRIPE_PRICE_ID_<PRICE_KEY>.
   * Empty means nothing is on sale.
   */
  CATALOGUE_JSON: z.string().optional(),

  // --- operational switches -----------------------------------------------
  FEATURE_SUBSCRIPTIONS_ENABLED: bool(false),
  /** A first-sign-in gift of credits. Off until there is something to spend them on. */
  FEATURE_FREE_TRIAL_ENABLED: bool(false),
  FREE_TRIAL_UNITS: int(2),
  /*
   * How much one account may buy in a rolling day, and how many orders it may
   * start.
   *
   * docs/FRAUD_PREVENTION.md ticked "velocity / amount limits per account" on
   * the strength of the two limits above, and said so plainly in its own
   * "what is still not true" section: those cap generation and export, which
   * protect CAPACITY. A stolen card buying forty DROP packs in an hour met no
   * limit at all, on the channel that carries every payment today.
   *
   * Two numbers because the two abuses look different. A stolen card that
   * works is VALUE — few orders, each one real money. Card testing is COUNT —
   * many attempts, most of them declined, which a value cap never sees
   * because nothing is ever paid.
   *
   * The value default is deliberately generous: ¥50,000 a day is fifty DROP
   * packs, which no real customer reaches and a card thief does. A cap that
   * stops a genuine purchase is its own kind of failure, so the number is set
   * where the damage is bounded rather than where abuse begins. Zero switches
   * either cap off, which is what a deployment with no card channel wants.
   *
   * A rolling window, not a calendar day: a cap that resets at midnight is a
   * cap with a known gap in it.
   */
  PURCHASE_CAP_JPY_PER_DAY: int(50_000),
  PURCHASE_CAP_ORDERS_PER_DAY: int(20),
  /*
   * Holding a paid card order until a person has looked at it.
   *
   * ⑥ in docs/FRAUD_PREVENTION.md was real for the stablecoin channel and
   * absent for the card one. What is held is DELIVERY, never the payment:
   * Stripe has taken it already, and the thing that cannot be undone is the
   * song someone downloaded, not the charge.
   *
   * The thresholds are set so that almost nothing is held, because a hold on a
   * legitimate purchase is a customer who paid and got nothing — at this scale
   * the worse of the two failures. A brand-new account spending ¥5,000 in its
   * first hour is roughly five DROP packs before anything has been listened
   * to; ten orders started in a day is where a person would have begun to
   * wonder, while the purchase cap stops the twentieth.
   *
   * Zero switches a signal off individually; CARD_REVIEW_ENABLED=false stops
   * all of it, which is what a deployment with no card channel wants.
   */
  CARD_REVIEW_ENABLED: bool(true),
  CARD_REVIEW_NEW_ACCOUNT_MINUTES: int(60),
  CARD_REVIEW_NEW_ACCOUNT_VALUE_MINOR: int(5_000),
  CARD_REVIEW_VELOCITY_ORDERS: int(10),
  EXPIRED_BATCH_COMPENSATION_DAYS: int(30),

  // --- legal disclosure (特定商取引法, SEC-13 in yuha) ----------------------
  LEGAL_ENTITY_NAME: z.string().optional(),
  LEGAL_ENTITY_REPRESENTATIVE: z.string().optional(),
  LEGAL_ENTITY_CONTACT: z.string().optional(),
  LEGAL_ENTITY_PHONE: z.string().optional(),

  // --- 一句成境 (docs/02 §5.3, docs/01 P9) -----------------------------------
  /** Revocable invite tokens; without one the client stays local. */
  INVITE_TOKENS: csv,
  /** Salt for the sentence cache keys; random per process when unset. */
  SCENE_CACHE_SALT: z.string().default(() => randomBytes(16).toString('hex')),
  SCENE_CACHE_TTL_HOURS: decimal(24),
  SCENE_TIMEOUT_MS: decimal(2300),
  /** Three caps: per invite per day, the whole site per day, and the project in total. */
  SCENE_DAILY_PER_INVITE: decimal(60),
  SCENE_DAILY_BUDGET_JPY: decimal(300),
  SCENE_TOTAL_BUDGET_JPY: decimal(5000),
  /** Estimated cost of one model call, in yen, until real billing data is in. */
  TOKENSTARS_COST_MINOR_PER_REQUEST: decimal(0.2),
  /** Where the AI spend counters are kept between restarts. */
  USAGE_FILE: z.string().default('server-data/usage.json'),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface AppConfig extends RawEnv {
  mode: RunMode;
  isDemo: boolean;
  adapters: {
    auth: 'dev' | 'google';
    payments: 'simulated' | 'stripe';
  };
  /** Accounts and payments need the database. */
  accountsEnabled: boolean;
  catalogue: CatalogueRow[];
  /** STRIPE_PRICE_ID_<PRICE_KEY>, read for every product in the catalogue. */
  stripePriceIds: Record<string, string | undefined>;
  legalEntityConfigured: boolean;
}

/** Defaults per mode. An explicit env var may narrow these, never widen them. */
const MODE_DEFAULT_ADAPTERS: Record<RunMode, AppConfig['adapters']> = {
  demo: { auth: 'dev', payments: 'simulated' },
  integration: { auth: 'dev', payments: 'simulated' },
  production: { auth: 'google', payments: 'stripe' },
};

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/**
 * The environment `loadConfig` actually reads: the process environment, then
 * each mounted secret file for a variable the environment does not already
 * set (APP_SECRET_DIR), as in yuha.
 */
export function resolveEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const configEnv = { ...env };
  if (configEnv.APP_SECRET_DIR) {
    if (!existsSync(configEnv.APP_SECRET_DIR)) {
      throw new ConfigError([`APP_SECRET_DIR is not mounted: ${configEnv.APP_SECRET_DIR}`]);
    }
    for (const name of readdirSync(configEnv.APP_SECRET_DIR)) {
      if (/^[A-Z][A-Z0-9_]*$/.test(name) && !configEnv[name]) {
        configEnv[name] = readFileSync(join(configEnv.APP_SECRET_DIR, name), 'utf8');
      }
    }
  }
  return configEnv;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const configEnv = resolveEnv(env);
  const parsed = envSchema.safeParse(configEnv);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  const e = parsed.data;
  const mode = e.RUN_MODE;
  const defaults = MODE_DEFAULT_ADAPTERS[mode];
  const adapters: AppConfig['adapters'] = {
    auth: e.AUTH_ADAPTER ?? defaults.auth,
    payments: e.PAYMENTS_ADAPTER ?? defaults.payments,
  };
  const accountsEnabled = !!e.DATABASE_URL;

  const problems: string[] = [];

  let catalogue: CatalogueRow[] = [];
  try {
    catalogue = parseCatalogue(e.CATALOGUE_JSON);
  } catch (err) {
    problems.push(`CATALOGUE_JSON: ${(err as Error).message}`);
  }
  const stripePriceIds: Record<string, string | undefined> = {};
  for (const row of catalogue) {
    const v = configEnv[`STRIPE_PRICE_ID_${row.price_key.toUpperCase()}`]?.trim();
    stripePriceIds[row.price_key] = v || undefined;
  }

  // ---- production must not contain any development affordance (SEC-03) ----
  if (mode === 'production') {
    if (adapters.auth === 'dev') problems.push('production mode cannot use the dev auth adapter');
    if (adapters.payments !== 'stripe') problems.push('production mode cannot use simulated payments');
    if (e.DEV_AUTH_SECRET) problems.push('DEV_AUTH_SECRET must not be set in production');
    if (!e.ADMIN_MFA_REQUIRED) problems.push('production mode cannot disable the staff second factor');
    if (accountsEnabled && (!e.LEGAL_ENTITY_NAME || !e.LEGAL_ENTITY_CONTACT)) {
      problems.push(
        'production mode requires LEGAL_ENTITY_NAME and LEGAL_ENTITY_CONTACT ' +
          '(特定商取引法 disclosure must not be a placeholder)',
      );
    }
    if (accountsEnabled && !e.DATABASE_SSL) problems.push('production mode requires DATABASE_SSL=true');
  }

  // ---- per-adapter requirements (only when accounts are on) -------------
  if (accountsEnabled) {
    if (adapters.auth === 'google') {
      if (!e.GOOGLE_CLIENT_ID) problems.push('GOOGLE_CLIENT_ID is required for the google auth adapter');
      if (!e.GOOGLE_CLIENT_SECRET) problems.push('GOOGLE_CLIENT_SECRET is required for the google auth adapter');
      if (!e.GOOGLE_REDIRECT_URI) {
        problems.push('GOOGLE_REDIRECT_URI is required for the google auth adapter');
      }
    } else if (!e.DEV_AUTH_SECRET) {
      problems.push('DEV_AUTH_SECRET is required for the dev auth adapter');
    }
  }

  /*
   * The Google flow is gated on CREDENTIALS, not on the adapter — so its
   * checks have to be too.
   *
   * `routes/auth.ts` registers `/v1/auth/google/*` whenever the three
   * variables are present, deliberately, "so Sign in with Google can coexist
   * with the dev login in integration mode". Every check below used to live
   * inside `adapters.auth === 'google'`, which means the configuration
   * `.env.example` itself ships — `AUTH_ADAPTER=dev` with the three Google
   * values filled — had a live OAuth endpoint and no validation of any of it.
   * The redirect-URI check was written to make a wrong value impossible to
   * deploy and was absent in the most common way to run the flow.
   *
   * Worse for the session secret: `stateSecret()` is
   * `GOOGLE_SESSION_SECRET ?? DEV_AUTH_SECRET ?? ''`, and production forbids
   * `DEV_AUTH_SECRET`. With a non-google adapter in production the secret
   * check did not run, so the OAuth `state` would have been signed with the
   * empty string — forgeable — which is the exact defect
   * `tests/blank-secrets.test.ts` exists for, one layer along.
   */
  const googleRedirect = e.GOOGLE_REDIRECT_URI;
  const googleFlowLive = !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && googleRedirect);
  if (googleFlowLive && googleRedirect) {
    {
      /*
       * Checked for shape, not just presence — because the failure mode has
       * no logs.
       *
       * Google compares `redirect_uri` against its registered list byte for
       * byte and answers `redirect_uri_mismatch` on its own page, before the
       * request reaches us. Nothing is written anywhere on our side; the only
       * evidence is the address bar. So the two plausible mistakes are worth
       * refusing at start-up, where the message can name them:
       *
       *   - the SPA's path (`/auth/google/callback`) instead of the API's.
       *     That route exists and is part of the flow — it is where we send
       *     the browser afterwards with a one-time code — so it reads like
       *     the callback;
       *   - a host carried over from the previous deployment. The variable is
       *     an absolute URL because Google needs the origin, so moving
       *     environments means every copy of it is stale.
       */
      let parsed: URL | null = null;
      try {
        parsed = new URL(googleRedirect);
      } catch {
        problems.push(`GOOGLE_REDIRECT_URI must be an absolute URL (got "${googleRedirect}")`);
      }
      if (parsed) {
        /*
         * A query string or a fragment is a different URI to Google, which
         * compares the whole thing byte for byte — so
         * `…/callback?env=prod` passes every other check here and then fails
         * at Google with the logless mismatch this block exists to prevent.
         */
        if (parsed.search || parsed.hash) {
          problems.push(
            'GOOGLE_REDIRECT_URI must carry no query string and no fragment — Google compares the whole URI byte for byte',
          );
        }
        if (parsed.pathname !== GOOGLE_CALLBACK_PATH) {
          problems.push(
            `GOOGLE_REDIRECT_URI must end in ${GOOGLE_CALLBACK_PATH} (got "${parsed.pathname}")` +
              (parsed.pathname === GOOGLE_WEB_RETURN_PATH
                ? ' — that is the web app\'s own return path, which Google must never be given'
                : ''),
          );
        }
        if (mode === 'production' && parsed.protocol !== 'https:') {
          problems.push('GOOGLE_REDIRECT_URI must be https in production');
        }
        /*
         * And it must be OUR api's origin. `PUBLIC_API_URL` is what the
         * deployment says the API is reachable at, so a redirect URI pointing
         * somewhere else is either a stale host or the web origin — and the
         * second one is the mistake above wearing a different hat, since the
         * SPA and the API can share a hostname.
         */
        const apiOrigin = new URL(e.PUBLIC_API_URL).origin;
        if (parsed.origin !== apiOrigin) {
          problems.push(
            `GOOGLE_REDIRECT_URI points at ${parsed.origin} but PUBLIC_API_URL says the API is at ${apiOrigin} — it must be ${apiOrigin}${GOOGLE_CALLBACK_PATH}`,
          );
        }
      }
    }
    if (mode === 'production' && !e.GOOGLE_SESSION_SECRET) {
      problems.push('GOOGLE_SESSION_SECRET is required whenever the Google sign-in is configured in production');
    }
  }


  if (accountsEnabled && adapters.payments === 'stripe') {
    if (!e.STRIPE_SECRET_KEY) problems.push('STRIPE_SECRET_KEY is required for the stripe payments adapter');
    if (!e.STRIPE_WEBHOOK_SECRET) problems.push('STRIPE_WEBHOOK_SECRET is required for webhook verification');
    /*
     * Every product in the catalogue, not the ones somebody remembered (yuha:
     * a missing id was not a boot failure but a 500 on the one page that takes
     * money). Subscriptions only while they are on sale.
     */
    for (const row of catalogue) {
      if (row.kind === 'subscription' && !e.FEATURE_SUBSCRIPTIONS_ENABLED) continue;
      if (!stripePriceIds[row.price_key]) {
        problems.push(`STRIPE_PRICE_ID_${row.price_key.toUpperCase()} is required for the stripe payments adapter (product ${row.price_key})`);
      }
    }
    /*
     * The webhook secret is a shape we can check without knowing the value.
     *
     * Endpoint secrets are `whsec_...`. The two things most easily pasted into
     * this variable instead are the restricted API key (`rk_...`) and the
     * secret key (`sk_...`), and both produce a signature that never verifies
     * — which surfaces as every event rejected with 400 and looks, from the
     * Stripe dashboard, exactly like our server being broken. Checking the
     * prefix costs nothing and never reveals the secret: no value is pushed
     * into the problem text here or anywhere else.
     */
    if (e.STRIPE_WEBHOOK_SECRET && !e.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
      problems.push('STRIPE_WEBHOOK_SECRET does not look like a Stripe endpoint signing secret (expected a whsec_ prefix)');
    }
    /*
     * The API version is a deployment decision in production, not a default.
     *
     * The event payloads this code reads depend on it: an Invoice's
     * subscription moved under `parent.subscription_details` and a
     * Subscription's period moved onto its items, both handled in
     * services/webhooks.ts, both version-dependent. Left unset, the version is
     * whatever this SDK happens to pin — 2025-02-24.acacia today — so a
     * routine `stripe` bump would silently change the shape of every live
     * event. It also has to be 2025-03-31.basil or greater for an account with
     * Managed Payments, which is only discovered by a failing live checkout.
     */
    if (mode === 'production' && !e.STRIPE_API_VERSION) {
      problems.push('STRIPE_API_VERSION must be set explicitly in production (the webhook payload shape depends on it; 2025-03-31.basil is the version this code is written against)');
    }
    /*
     * And it has to be a version, not a string.
     *
     * Requiring only that the variable is non-empty would accept `basil`, or
     * `2024-06-20` — a version older than the Checkout minimum, which fails at
     * the first live purchase and nowhere earlier. Stripe's versions are
     * date-ordered with a codename suffix, so the date compares
     * lexicographically and `STRIPE_API_VERSION_FLOOR` is the one this code is
     * written against. Newer is allowed and unverified: the SDK's types are
     * generated against its own version, so a newer account version is a
     * deliberate choice somebody makes, not an accident this check should
     * block.
     */
    if (e.STRIPE_API_VERSION) {
      const shape = /^(\d{4}-\d{2}-\d{2})(\.[a-z]+)?$/.exec(e.STRIPE_API_VERSION.trim());
      if (!shape) {
        problems.push(
          `STRIPE_API_VERSION is not a Stripe API version (expected YYYY-MM-DD or YYYY-MM-DD.codename, e.g. ${STRIPE_API_VERSION_FLOOR})`,
        );
      } else if (shape[1]! < STRIPE_API_VERSION_FLOOR.slice(0, 10)) {
        problems.push(
          `STRIPE_API_VERSION ${e.STRIPE_API_VERSION} is older than ${STRIPE_API_VERSION_FLOOR}, which Checkout requires on an account with Managed Payments and which this code's webhook handling is written against`,
        );
      }
    }
    if (/^(sk|rk)_live_/.test(e.STRIPE_SECRET_KEY ?? '') && mode !== 'production') {
      problems.push(`a live Stripe key cannot be used in ${mode} mode`);
    }
    if (/^(sk|rk)_test_/.test(e.STRIPE_SECRET_KEY ?? '') && mode === 'production') {
      problems.push('production mode requires a live Stripe key, not a test key');
    }
  } else if (mode !== 'production' && /^(sk|rk)_live_/.test(e.STRIPE_SECRET_KEY ?? '')) {
    problems.push('a live Stripe key is present outside production mode — remove it');
  }


  if (accountsEnabled && e.STABLECOIN_ENABLED) {
    if (!e.STABLECOIN_RECEIVER_ADDRESS) {
      problems.push('STABLECOIN_RECEIVER_ADDRESS is required when stablecoin payments are enabled');
    } else if (!/^0x[0-9a-fA-F]{40}$/.test(e.STABLECOIN_RECEIVER_ADDRESS)) {
      problems.push('STABLECOIN_RECEIVER_ADDRESS is not an Ethereum address');
    }
    if (!e.STABLECOIN_JPYC_ENABLED && !e.STABLECOIN_USDC_ENABLED) {
      problems.push('stablecoin payments are enabled but no currency is');
    }
    /*
     * Both nodes are required, and they must not be the same URL.
     *
     * One node cannot disagree with itself, so a single endpoint used twice
     * turns "hold when the nodes disagree" into a line that always passes —
     * the exact shape of check this project keeps finding in its own work.
     * Whether two different URLs are really two different companies is not
     * something config can see; that one is on the person setting it.
     */
    if (!e.POLYGON_RPC_PRIMARY_URL || !e.POLYGON_RPC_SECONDARY_URL) {
      problems.push('stablecoin payments need POLYGON_RPC_PRIMARY_URL and POLYGON_RPC_SECONDARY_URL');
    } else if (e.POLYGON_RPC_PRIMARY_URL === e.POLYGON_RPC_SECONDARY_URL) {
      problems.push('the two Polygon RPC URLs are identical; a node cannot disagree with itself');
    }
    /*
     * USDC used to be refused here outright: there was no rate source, and
     * quoting from a hardcoded number would charge the wrong amount for a
     * product priced in yen. It now quotes from two live USD/JPY sources and
     * refuses a QUOTE (not the deployment) whenever they are missing, stale or
     * disagree — `services/stablecoin-rate.ts`. There is still no fallback.
     */
  }


  if (e.FEATURE_FREE_TRIAL_ENABLED && e.FREE_TRIAL_UNITS > 2) {
    problems.push('FREE_TRIAL_UNITS must not exceed 2');
  }

  if (problems.length) throw new ConfigError(problems);

  return {
    ...e,
    mode,
    isDemo: mode === 'demo',
    adapters,
    accountsEnabled,
    catalogue,
    stripePriceIds,
    legalEntityConfigured: !!(e.LEGAL_ENTITY_NAME && e.LEGAL_ENTITY_CONTACT),
  };
}

/**
 * Feature switches, combining static configuration with the operator-editable
 * runtime settings table. Nothing here can turn ON something the mode forbids —
 * a switch can only narrow what configuration already permits.
 */
export interface FeatureFlags {
  subscriptionsEnabled: boolean;
  freeTrialEnabled: boolean;
  realPaymentsEnabled: boolean;
  /**
   * Whether a card purchase started here can actually finish. Stripe, or the
   * demo — where the simulated round trip is the point. Simulated payments
   * anywhere else cannot complete: the settle page refuses outside demo, and
   * the sessions live in one process while a deployment runs several. That
   * is how yuha.studio sent every buyer to "this page is for demo mode only".
   */
  cardPaymentsEnabled: boolean;
}

export function baseFeatures(cfg: AppConfig): FeatureFlags {
  return {
    // Subscriptions are built and tested but default OFF until WonderLab decides to sell them.
    subscriptionsEnabled: cfg.FEATURE_SUBSCRIPTIONS_ENABLED,
    freeTrialEnabled: cfg.FEATURE_FREE_TRIAL_ENABLED,
    realPaymentsEnabled: cfg.adapters.payments === 'stripe',
    cardPaymentsEnabled: cfg.adapters.payments === 'stripe' || cfg.mode === 'demo',
  };
}
