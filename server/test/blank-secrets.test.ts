/**
 * A secret declared blank is not a secret.
 *
 * `.env` carried `GOOGLE_SESSION_SECRET=` — the key present, the value empty —
 * and the fallback that was supposed to cover that reads
 * `cfg.GOOGLE_SESSION_SECRET ?? cfg.DEV_AUTH_SECRET`. `??` does not catch the
 * empty string, so the effective session signing secret was `''`: every
 * Google-issued session was signed with an empty key, and anyone who knows the
 * token format could mint one for any account.
 *
 * This repo has met this exact bug before — a blank display name produced a
 * white screen because `??` let `""` through. It is the same mistake one layer
 * down, where it costs authentication rather than a render.
 *
 * Production was never exposed: `if (mode === 'production' && !e.GOOGLE_SESSION_SECRET)`
 * uses `!`, which does catch `''`, and refuses to start. Every other
 * environment was.
 *
 * The repair is at the schema, so it covers every optional secret rather than
 * the two fallbacks someone happened to look at.
 */
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const BASE = {
  RUN_MODE: 'demo',
  DATABASE_URL: 'mysql://u:p@localhost:3306/x',
  DEV_AUTH_SECRET: 'dev-secret',
  STORAGE_SIGNING_SECRET: 'storage-secret',
};

describe('an optional secret that is present but blank', () => {
  it('is treated as absent, so the fallback actually fires', () => {
    const cfg = loadConfig({ ...BASE, GOOGLE_SESSION_SECRET: '' } as never);
    expect(cfg.GOOGLE_SESSION_SECRET).toBeUndefined();
    // Which is what the `??` in auth/index.ts depends on.
    expect(cfg.GOOGLE_SESSION_SECRET ?? cfg.DEV_AUTH_SECRET).toBe('dev-secret');
  });

  it('refuses to start when a key that is actually required is blank', () => {
    // In yuha this was the storage signer; in WonderLab the nearest required
    // secret is the dev session key: blank must read as missing, not as ''.
    expect(() => loadConfig({ ...BASE, DEV_AUTH_SECRET: '' } as never))
      .toThrow(/DEV_AUTH_SECRET/);
  });

  it('leaves no secret as the empty string anywhere in the parsed config', () => {
    const cfg = loadConfig({
      ...BASE,
      GOOGLE_SESSION_SECRET: '',
      STRIPE_WEBHOOK_SECRET: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_PUBLISHABLE_KEY: '',
      GOOGLE_CLIENT_SECRET: '',
    } as never);
    for (const [name, value] of Object.entries(cfg)) {
      if (!/SECRET|_KEY$/.test(name)) continue;
      expect(value, `${name} came back as an empty string`).not.toBe('');
    }
  });

  it('keeps a real value untouched, and whitespace is not a value', () => {
    expect(loadConfig({ ...BASE, GOOGLE_SESSION_SECRET: 'real' } as never).GOOGLE_SESSION_SECRET)
      .toBe('real');
    // A key someone "filled in" with a space is the same mistake wearing a
    // different coat.
    expect(loadConfig({ ...BASE, GOOGLE_SESSION_SECRET: '   ' } as never).GOOGLE_SESSION_SECRET)
      .toBeUndefined();
  });

  it('still refuses to start in production when the secret is blank', () => {
    expect(() =>
      loadConfig({
        ...BASE,
        RUN_MODE: 'production',
        AUTH_ADAPTER: 'google',
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'cs',
        GOOGLE_REDIRECT_URI: 'https://x/cb',
        GOOGLE_SESSION_SECRET: '',
      } as never),
    ).toThrow(/GOOGLE_SESSION_SECRET/);
  });
});
