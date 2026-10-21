import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('CSI mounted application secrets', () => {
  it('loads file values without a synced Kubernetes Secret', () => {
    const dir = mkdtempSync(join(tmpdir(), 'yuha-secrets-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'GOOGLE_SESSION_SECRET'), 'mounted-session-key');
    writeFileSync(join(dir, 'STRIPE_SECRET_KEY'), 'sk_test_mounted');
    const config = loadConfig({
      APP_SECRET_DIR: dir,
      RUN_MODE: 'demo',
      DATABASE_URL: 'mysql://u:p@localhost:3306/x',
      DEV_AUTH_SECRET: 'dev-secret',
      STORAGE_SIGNING_SECRET: 'storage-secret',
    });
    expect(config.GOOGLE_SESSION_SECRET).toBe('mounted-session-key');
    expect(config.STRIPE_SECRET_KEY).toBe('sk_test_mounted');
  });

  it('reports a missing CSI mount before accepting configuration', () => {
    expect(() => loadConfig({ APP_SECRET_DIR: join(tmpdir(), 'yuha-no-such-secret-mount') }))
      .toThrow(/APP_SECRET_DIR is not mounted/);
  });
});
