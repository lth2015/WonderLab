import { describe, expect, it } from 'vitest';
import { boltPath, flashLevel, MAX_BOLT } from './storm';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

describe('boltPath', () => {
  it('runs from the clouds down to where it strikes, with a branch, within the shader limit', () => {
    const segs = boltPath(200, 800, 480, 390, seeded(3));
    expect(segs.length).toBeLessThanOrEqual(MAX_BOLT);
    expect(segs.length).toBeGreaterThan(15);
    expect(segs[0][1]).toBe(800);
    expect(segs[14][3]).toBe(480);
    for (const [, ay, , by] of segs) expect(by).toBeLessThan(ay);
  });
});

describe('flashLevel', () => {
  it('strikes at once, flickers, and is gone within a second and a half', () => {
    expect(flashLevel(0)).toBeCloseTo(1, 5);
    expect(flashLevel(0.12)).toBeLessThan(flashLevel(0.19));
    expect(flashLevel(1.6)).toBe(0);
    expect(flashLevel(-0.1)).toBe(0);
  });
});
