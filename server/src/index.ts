import { buildServer } from './app';
import { loadConfig } from './config';
import { chatJsonWith, configFromEnv } from './tokenstars';

// Local: `npm run server` (reads .env). The Vite dev server proxies /api here.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the environment.
}

const config = loadConfig();
const ts = configFromEnv();
const aiReady = !!(ts.apiKey && ts.model);
const app = await buildServer({ config, chat: chatJsonWith(ts), aiReady });
if (!aiReady) app.log.warn('TOKENSTARS_API_KEY / TOKENSTARS_MODEL_ID not set: 一句成境 stays local');
await app.listen({ port: config.PORT, host: config.HOST });
