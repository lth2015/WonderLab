import { describe, expect, it } from 'vitest';
import { placeClear } from './echo-layer';

// y grows upward, as in the engine. Panel 400×80 centred on x = 500.
describe('placeClear', () => {
  const band = { min: 300, max: 800 };

  it('keeps the preferred height when nothing is in the way', () => {
    expect(placeClear(500, 600, 400, 80, [{ x: 100, y: 600, r: 40 }], band)).toBe(600);
  });

  it('moves off a moon written across, to the nearer side that fits', () => {
    const moon = { x: 560, y: 610, r: 50 };
    const y = placeClear(500, 600, 400, 80, [moon], band);
    expect(Math.abs(y - moon.y)).toBeGreaterThanOrEqual(moon.r + 40 + 12);
    expect(y).toBeGreaterThanOrEqual(band.min + 40);
    expect(y).toBeLessThanOrEqual(band.max - 40);
  });

  it('goes to the other side when the near one leaves the sky', () => {
    const moon = { x: 500, y: 720, r: 50 };
    // Above the moon would need 720 + 50 + 12 + 40 > 760, outside the band.
    expect(placeClear(500, 740, 400, 80, [moon], band)).toBeLessThan(moon.y - moon.r - 40);
  });

  it('on a sky too short to clear the moon, tucks against its edge instead of crossing it', () => {
    // Phone-like: band 367..659, moon at 554 r 40, panel 300×123.
    const moon = { x: 227, y: 554, r: 40 };
    const short = { min: 382, max: 659 };
    const y = placeClear(187, 547, 300, 123, [moon], short);
    expect(y).toBeCloseTo(short.min + 123 / 2, 5);
    // The text's top edge stays below the moon itself, if inside the margin.
    expect(y + 123 / 2).toBeLessThanOrEqual(moon.y - moon.r);
  });

  it('keeps inside the band whatever happens', () => {
    const wall = [400, 500, 600, 700].map((y) => ({ x: 500, y, r: 80 }));
    const y = placeClear(500, 600, 400, 80, wall, band);
    expect(y).toBeGreaterThanOrEqual(band.min + 40);
    expect(y).toBeLessThanOrEqual(band.max - 40);
  });
});
