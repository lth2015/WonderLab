import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Shared request/response shapes from the server (types only in the browser).
    alias: { '@wonderlab/contracts': fileURLToPath(new URL('./server/packages/contracts/src/index.ts', import.meta.url)) },
  },
  server: {
    host: true,
    // `npm run server` in a second terminal answers these.
    proxy: { '/api': 'http://127.0.0.1:8787', '/v1': 'http://127.0.0.1:8787' },
  },
});
