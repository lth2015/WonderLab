import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { buildDefine } from './build-info';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The server's package aliases (server/tsconfig.json "paths"). */
export const alias = {
  '@wonderlab/contracts': at('./server/packages/contracts/src/index.ts'),
  '@wonderlab/db': at('./server/packages/db/src/index.ts'),
  '@wonderlab/providers': at('./server/packages/providers/src/index.ts'),
  '@wonderlab/api': at('./server/src/lib.ts'),
};

// `npm test`: everything that needs no database. Database tests are
// server/test/db, run by `npm run test:db` (vitest.db.config.ts).
export default defineConfig({
  resolve: { alias },
  define: buildDefine(),
  test: {
    include: ['src/**/*.test.ts', 'server/test/*.test.ts'],
  },
});
