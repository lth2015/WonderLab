import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 清明上河図：江戸編 — an app of its own (spec §14): it builds, serves and
// saves independently of the Wonderful World app at the repository root.
//
// EDO_BASE is the path it is served under: `/edo/` inside want.world (the
// default), or `/` on a domain of its own (spec §16). Every asset, link and
// storage key is relative to it, never fixed to the site root.
const base = process.env.EDO_BASE ?? '/edo/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error(`EDO_BASE must start and end with "/"; got "${base}"`);
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../../dist-edo', import.meta.url)),
    emptyOutDir: true,
  },
  server: { host: true, port: 5180 },
  preview: { port: 5180 },
});
