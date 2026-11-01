import { closeDb, databaseUrlFromSecretFile } from '@wonderlab/db';
import { buildServer } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createContext } from './context.js';
import { syncCatalogue } from './services/catalogue-sync.js';
import { chatJsonWith, configFromEnv } from './tokenstars.js';
import { startWorker } from './worker/index.js';

// Local: `npm run server` (reads .env). The Vite dev server proxies /api and /v1 here.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the environment.
}

// The runtime CSI mount contains only the database username/password. The
// endpoint, port and database name come from reviewed non-sensitive config.
// Do this before config validation and never print the mounted file or URL.
if (!process.env.DATABASE_URL && process.env.DATABASE_SECRET_FILE) {
  const databaseUrl = databaseUrlFromSecretFile(process.env.DATABASE_SECRET_FILE);
  if (!databaseUrl) {
    console.error(
      'Database credential file or DATABASE_HOST, DATABASE_PORT, DATABASE_NAME is incomplete.',
    );
    process.exit(1);
  }
  process.env.DATABASE_URL = databaseUrl;
}

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const ts = configFromEnv();
const aiReady = !!(ts.apiKey && ts.model);

let ctx = null;
let stopWorker: (() => Promise<void>) | null = null;
if (config.accountsEnabled) {
  ctx = createContext(config);
  // Schema changes are performed by the release-gated migration Job, never by
  // an API or Worker process. Catalogue sync remains part of this process's
  // existing runtime lifecycle.
  if (!(await syncCatalogue(ctx, config))) process.exit(1);
  if (config.RUN_WORKER) stopWorker = startWorker(ctx);
}

const edoChat = ts.apiKey && config.EDO_TALK_MODEL_ID ? chatJsonWith({ ...ts, model: config.EDO_TALK_MODEL_ID }) : null;
const app = await buildServer({ config, chat: chatJsonWith(ts), aiReady, ctx, edoChat });
if (!edoChat) app.log.warn('TOKENSTARS_API_KEY not set: 江戸編 talk falls back to its script');
if (!aiReady) app.log.warn('TOKENSTARS_API_KEY / TOKENSTARS_MODEL_ID not set: 一句成境 stays local');
if (!ctx) app.log.warn('DATABASE_URL not set: accounts and payments are off');

const shutdown = async () => {
  await app.close();
  await stopWorker?.();
  await closeDb();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
