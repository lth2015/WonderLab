import { describe, expect, it } from 'vitest';
import { seededRandom } from '../collect/synth';
import { FAMILIES, familyOf, overflowing, pickVariety, resampleTimed, STYLE, strokeStyle, VARIETIES } from './koi-style';

/** A gentle arc drawn over `ms`, `size` px across, sampled every `every` ms. */
function arc(size: number, ms: number, every = 16, bend = 0.3, x0 = 100, y0 = 100) {
  const pts = [];
  for (let t = 0; t <= ms; t += every) {
    const u = t / ms;
    pts.push({ x: x0 + u * size, y: y0 + Math.sin(u * Math.PI) * size * bend, t, pressure: 0.5 });
  }
  return pts;
}

describe('strokeStyle', () => {
  it('reads the same stroke the same on a bigger canvas', () => {
    const a = strokeStyle(arc(200, 500), 800, 'mouse');
    const b = strokeStyle(arc(400, 500), 1600, 'mouse');
    expect(b.speed).toBeCloseTo(a.speed, 2);
    expect(b.curviness).toBeCloseTo(a.curviness, 2);
  });

  it('reads the same stroke the same at any sampling rate', () => {
    const slow = strokeStyle(arc(300, 600, 16), 800, 'pen');
    const fast = strokeStyle(arc(300, 600, 4), 800, 'pen');
    expect(fast.speed).toBeCloseTo(slow.speed, 1);
    expect(fast.curviness).toBeCloseTo(slow.curviness, 1);
  });

  it('is not fooled by tremor on a fast device', () => {
    const r = seededRandom(3);
    const clean = arc(300, 600, 4);
    const shaky = clean.map((p) => ({ ...p, x: p.x + (r() - 0.5) * 1.5, y: p.y + (r() - 0.5) * 1.5 }));
    expect(strokeStyle(shaky, 800, 'pen').speed / strokeStyle(clean, 800, 'pen').speed).toBeLessThan(1.15);
  });

  it('reads a shaky straight line as straight, and a half circle or an S as curved', () => {
    const r = seededRandom(9);
    const line = arc(300, 600, 8, 0).map((p) => ({ ...p, x: p.x + (r() - 0.5) * 3, y: p.y + (r() - 0.5) * 3 }));
    expect(strokeStyle(line, 800, 'mouse').curviness).toBeLessThan(0.2);
    const half = Array.from({ length: 60 }, (_, i) => ({ x: 300 + 100 * Math.cos((Math.PI * i) / 59), y: 300 + 100 * Math.sin((Math.PI * i) / 59), t: i * 10 }));
    expect(strokeStyle(half, 800, 'mouse').curviness).toBeGreaterThan(0.8);
    const s = Array.from({ length: 80 }, (_, i) => ({ x: 300 + 60 * Math.sin((2 * Math.PI * i) / 79), y: 200 + 2 * i, t: i * 10 }));
    expect(strokeStyle(s, 800, 'mouse').curviness).toBeGreaterThan(STYLE.curvySplit);
  });

  it('sorts strokes into the four families', () => {
    expect(familyOf(3, 0.2, 'mouse')).toBe('brisk');
    expect(familyOf(3, 1.2, 'mouse')).toBe('lively');
    expect(familyOf(0.3, 0.2, 'mouse')).toBe('calm');
    expect(familyOf(0.3, 1.2, 'mouse')).toBe('round');
  });

  it('splits fast from slow per pointer type', () => {
    const { mouse, touch } = STYLE.fastSplit;
    expect(mouse).not.toBe(touch);
    // A speed between the two splits is fast for one pointer and slow for the other.
    const v = (touch + mouse) / 2;
    const [lower, higher] = mouse < touch ? ['mouse', 'touch'] : ['touch', 'mouse'];
    expect(familyOf(v, 0, lower)).toBe('brisk');
    expect(familyOf(v, 0, higher)).toBe('calm');
    // Unknown pointers (the keyboard) read like a mouse.
    expect(familyOf(v, 0, 'keyboard')).toBe(familyOf(v, 0, 'mouse'));
  });
});

describe('pickVariety', () => {
  it('comes from the stroke’s family about three times in four, and from any other variety otherwise', () => {
    const r = seededRandom(42);
    let own = 0;
    const seen = new Set<string>();
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const { variety, inFamily } = pickVariety('calm', r);
      expect(FAMILIES.calm.includes(variety)).toBe(inFamily);
      if (inFamily) own++;
      seen.add(variety);
    }
    expect(own / n).toBeGreaterThan(STYLE.familyChance - 0.03);
    expect(own / n).toBeLessThan(STYLE.familyChance + 0.03);
    expect(seen.size).toBe(VARIETIES.length);
  });

  it('keeps to the skins that loaded', () => {
    const r = seededRandom(1);
    for (let i = 0; i < 200; i++) expect(['kohaku', 'sumi']).toContain(pickVariety('round', r, ['kohaku', 'sumi']).variety);
    // Only the family is available: always from it.
    expect(pickVariety('round', r, ['ogon'])).toEqual({ variety: 'ogon', inFamily: true });
  });
});

describe('resampleTimed', () => {
  it('keeps when the hand passed each point', () => {
    // Slow first half, fast second half.
    const pts = [
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 800 },
      { x: 200, y: 0, t: 1000 },
    ];
    const out = resampleTimed(pts, 5);
    expect(out.map((p) => p.x)).toEqual([0, 50, 100, 150, 200]);
    expect(out.map((p) => Math.round(p.t))).toEqual([0, 400, 800, 900, 1000]);
  });
});

describe('overflowing', () => {
  it('lets the oldest go first, but never the first fish', () => {
    const fish = [{ honmei: true, id: 1 }, { honmei: false, id: 2 }, { honmei: false, id: 3 }, { honmei: false, id: 4 }];
    expect(overflowing(fish, 2).map((f) => f.id)).toEqual([2, 3]);
    expect(overflowing(fish, 4)).toEqual([]);
  });
});
