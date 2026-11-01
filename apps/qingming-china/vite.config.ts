import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  base: './',
  build: {
    outDir: process.env.QINGMING_OUT_DIR
      ? fileURLToPath(new URL(`../../${process.env.QINGMING_OUT_DIR}`, import.meta.url))
      : 'dist',
    emptyOutDir: true,
  },
  server: { fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
});
