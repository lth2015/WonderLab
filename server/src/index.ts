import { closeDb, migrate } from '@wonderlab/db';
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
  // Bring the schema and the catalogue up to date before taking traffic.
  await migrate();
  if (!(await syncCatalogue(ctx, config))) process.exit(1);
  if (config.RUN_WORKER) stopWorker = startWorker(ctx);
}

const app = await buildServer({ config, chat: chatJsonWith(ts), aiReady, ctx });
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
