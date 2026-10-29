import { describe, expect, it } from 'vitest';
import { flashLevel, MAX_BOLT, packSegment, strike, strikeAlong } from './storm';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

describe('strike', () => {
  it('is two or three forking bolts and a crawler along the cloud base, within the shader limit', () => {
    const segs = strike(200, 800, 480, 390, 390, seeded(3));
    expect(segs.length).toBeLessThanOrEqual(MAX_BOLT);
    expect(segs.length).toBeGreaterThan(30);
    const trunks = segs.filter((s) => s[4] === 1);
    expect(trunks.length).toBeGreaterThan(10);
    // Trunks reach down to where it strikes; branches are fainter.
    expect(Math.min(...trunks.map((s) => s[3]))).toBeLessThanOrEqual(481);
    expect(segs.some((s) => s[4] < 1)).toBe(true);
    // Trunks come first, so the finest twigs are what the limit drops.
    expect(segs.findIndex((s) => s[4] < 1)).toBe(trunks.length);
  });

  it('follows a drawn line from its higher end and carries on down to the hills', () => {
    // Drawn upward, stopping well above the hills at y 480.
    const path = Array.from({ length: 20 }, (_, i) => ({ x: 150 + i * 2, y: 620 + i * 10 }));
    const segs = strikeAlong(path, 480, 390, seeded(5));
    expect(segs.length).toBeLessThanOrEqual(MAX_BOLT);
    const trunks = segs.filter((s) => s[4] === 1);
    expect(trunks[0][1]).toBeCloseTo(810, 0);
    expect(Math.abs(trunks[0][0] - 188)).toBeLessThan(1);
    expect(Math.min(...trunks.map((s) => s[3]))).toBeLessThanOrEqual(481);
    expect(segs.some((s) => s[4] < 1)).toBe(true);
    expect(segs.every((s) => s[3] >= 480 - 390 * 0.5)).toBe(true);
  });

  it('packs strength into the fraction of a.x', () => {
    const [ax] = packSegment([120.7, 0, 0, 0, 0.5]);
    expect(Math.floor(ax)).toBe(120);
    expect((ax % 1) / 0.9).toBeCloseTo(0.5, 5);
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
