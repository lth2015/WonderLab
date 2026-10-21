import { defineConfig } from 'vitest/config';
import { alias } from './vitest.config';

// Database tests (as in yuha): a real MySQL at TEST_DATABASE_URL, default
// mysql://root:root@127.0.0.1:53307/wonderlab_test (`npm run db:up`). The
// ledger tests race transactions against one instance, so files run one at a
// time.
export default defineConfig({
  resolve: { alias },
  test: {
    include: ['server/test/db/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
