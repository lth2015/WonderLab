import { describe, expect, it } from 'vitest';
import { moonPathAt, offFramePathPoint, sunPathAt } from './moonlight';

const view = { width: 390, horizonY: 464, S: 390 };

describe('moonPathAt', () => {
  it('lies under a drawn moon and nowhere above the horizon', () => {
    const moon = { x: 270, r: 34 };
    expect(moonPathAt(270, 400, view, moon, 1)).toBeCloseTo(1, 5);
    expect(moonPathAt(270, 400, view, moon, 1)).toBeGreaterThan(moonPathAt(60, 400, view, moon, 1));
    expect(moonPathAt(270, 500, view, moon, 1)).toBe(0);
  });

  it('widens toward the viewer and on a moonlit night', () => {
    const moon = { x: 200, r: 30 };
    expect(moonPathAt(260, 150, view, moon, 0)).toBeGreaterThan(moonPathAt(260, 440, view, moon, 0));
    expect(moonPathAt(260, 300, view, moon, 1)).toBeGreaterThan(moonPathAt(260, 300, view, moon, 0));
  });

  it('with no moon drawn, comes in from the left only on a moonlit night', () => {
    const p = offFramePathPoint(view);
    expect(moonPathAt(p.x, p.y, view, null, 1)).toBeGreaterThan(0.8);
    expect(moonPathAt(p.x, p.y, view, null, 1)).toBeGreaterThan(moonPathAt(view.width - 10, p.y, view, null, 1));
    expect(moonPathAt(p.x, p.y, view, null, 0)).toBe(0);
  });
});

describe('sunPathAt', () => {
  const view = { width: 400, horizonY: 500, S: 400 };
  it('lies under the setting sun, fades toward the viewer, and only at dusk', () => {
    const under = sunPathAt(304, 480, view, 1);
    expect(under).toBeGreaterThan(0.8);
    expect(sunPathAt(60, 480, view, 1)).toBeLessThan(0.01);
    expect(sunPathAt(304, 200, view, 1)).toBeLessThan(under * 0.2);
    expect(sunPathAt(304, 480, view, 0)).toBe(0);
    expect(sunPathAt(304, 520, view, 1)).toBe(0);
  });
});
