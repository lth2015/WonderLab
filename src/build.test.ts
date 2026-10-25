import { describe, expect, it } from 'vitest';
import { BUILD, giftEnabled, LOG_SCHEMA } from './build';

describe('build info (docs/验证路线图.md §4)', () => {
  it('is written in at build time: a commit, an experiment and the log schema', () => {
    expect(BUILD.sha).toMatch(/^([0-9a-f]{7,40}(-dirty)?|unknown)$/);
    expect(['dev', 'poc-r1', 'poc-gift-r1']).toContain(BUILD.experiment);
    expect(BUILD.schema).toBe(LOG_SCHEMA);
  });

  it('keeps 送一条鱼 out of every build but poc-gift-r1, except ?giftlab in development', () => {
    // These tests run as the dev build.
    expect(BUILD.experiment).toBe('dev');
    expect(giftEnabled(new URLSearchParams(''), true)).toBe(false);
    expect(giftEnabled(new URLSearchParams('giftlab'), true)).toBe(true);
    // A production build of anything but poc-gift-r1 ignores ?giftlab.
    expect(giftEnabled(new URLSearchParams('giftlab'), false)).toBe(false);
  });
});
