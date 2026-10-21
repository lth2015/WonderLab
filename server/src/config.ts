import { randomBytes } from 'node:crypto';
import { z } from 'zod';

// Server configuration from the environment (and .env, loaded in index.ts),
// validated once at start-up the way yuha's apps/api/src/config.ts does.

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
const num = (fallback: number) => z.coerce.number().nonnegative().default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Web origins allowed to call the API (CORS and the Origin check). */
  ALLOWED_ORIGINS: csv,

  // 一句成境 (docs/02 §5.3, docs/01 P9)
  /** Revocable invite tokens; without one the client stays local. */
  INVITE_TOKENS: csv,
  /** Salt for the sentence cache keys; random per process when unset. */
  SCENE_CACHE_SALT: z.string().default(() => randomBytes(16).toString('hex')),
  SCENE_CACHE_TTL_HOURS: num(24),
  SCENE_TIMEOUT_MS: num(2300),
  /** Three caps: per invite per day, the whole site per day, and the project in total. */
  SCENE_DAILY_PER_INVITE: num(60),
  SCENE_DAILY_BUDGET_JPY: num(300),
  SCENE_TOTAL_BUDGET_JPY: num(5000),
  /** Estimated cost of one model call, in yen, until real billing data is in. */
  TOKENSTARS_COST_MINOR_PER_REQUEST: num(0.2),
  /** Where the spend counters are kept between restarts. */
  USAGE_FILE: z.string().default('server-data/usage.json'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid configuration: ${issues}`);
  }
  return parsed.data;
}
