import { describe, expect, it } from 'vitest';
import { classify, spineFromOutline, type Pt, type StrokeKind } from './classify';

// Synthetic versions of the docs/02 §4 test set: wobbly hand-drawn shapes,
// 50 seeded variants of each. Real pen data replaces these in stage A.
const MIN_DIM = 800;
const RUNS = 50;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type Gen = (r: () => number) => Pt[];

/** Smooth wobble plus a little jitter, like a hand. */
function hand(r: () => number, pts: Pt[], amount: number): Pt[] {
  const f1 = 1 + r() * 2;
  const f2 = 3 + r() * 3;
  const p1 = r() * 6.28;
  const p2 = r() * 6.28;
  return pts.map((p, i) => {
    const t = i / pts.length;
    const w = Math.sin(t * 6.28 * f1 + p1) * amount + Math.sin(t * 6.28 * f2 + p2) * amount * 0.4;
    return { x: p.x + w + (r() - 0.5) * 1.5, y: p.y + w * 0.7 + (r() - 0.5) * 1.5 };
  });
}

function rotate(pts: Pt[], a: number): Pt[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map((p) => ({ x: 400 + (p.x - 400) * c - (p.y - 400) * s, y: 400 + (p.x - 400) * s + (p.y - 400) * c }));
}

const circle: Gen = (r) => {
  const R = 50 + r() * 90;
  const squash = 1 + r() * 0.3;              // 歪圆: up to 1.3:1
  const sweep = (330 + r() * 50) * (Math.PI / 180); // under- or overshoot the join
  const a0 = r() * 6.28;
  const dir = r() < 0.5 ? 1 : -1;
  const pts: Pt[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = a0 + dir * sweep * (i / 80);
    pts.push({ x: 400 + Math.cos(a) * R * squash, y: 400 + Math.sin(a) * R });
  }
  return rotate(hand(r, pts, R * 0.05), r() * 6.28);
};

const halfCircle: Gen = (r) => {
  const R = 60 + r() * 80;
  const sweep = (165 + r() * 40) * (Math.PI / 180);
  const pts: Pt[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = sweep * (i / 60);
    pts.push({ x: 400 + Math.cos(a) * R, y: 400 + Math.sin(a) * R });
  }
  return rotate(hand(r, pts, R * 0.04), r() * 6.28);
};

const fishOutline: Gen = (r) => {
  const a = 90 + r() * 80;
  const b = a * (0.3 + r() * 0.15);
  const pts: Pt[] = [];
  // Body outline from the tail round the head and back, then a forked tail.
  for (let i = 0; i <= 70; i++) {
    const t = Math.PI * 0.12 + (i / 70) * Math.PI * 1.76;
    const bulge = 1 + 0.25 * Math.cos(t); // fuller towards the head
    pts.push({ x: 400 - Math.cos(t) * a, y: 400 + Math.sin(t) * b * bulge });
  }
  const end = pts[pts.length - 1];
  pts.push({ x: end.x + a * 0.35, y: end.y - b * 0.6 }, { x: end.x + a * 0.25, y: 400 }, { x: end.x + a * 0.35, y: 400 + b * 0.9 });
  pts.push({ x: pts[0].x, y: pts[0].y });
  return rotate(hand(r, pts, 3), r() * 6.28);
};

const sShape: Gen = (r) => {
  const L = 200 + r() * 200;
  const A = L * (0.12 + r() * 0.1);
  const pts: Pt[] = [];
  for (let i = 0; i <= 60; i++) pts.push({ x: 300 + (L * i) / 60, y: 400 + Math.sin((i / 60) * Math.PI * 2) * A });
  return rotate(hand(r, pts, 4), r() * 6.28);
};

const spiral: Gen = (r) => {
  const turns = 1.6 + r() * 1.2;
  const R = 90 + r() * 60;
  const pts: Pt[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const a = t * turns * 6.28;
    const rr = R * (0.15 + 0.85 * t);
    pts.push({ x: 400 + Math.cos(a) * rr, y: 400 + Math.sin(a) * rr });
  }
  return rotate(hand(r, pts, 3), r() * 6.28);
};

const uShape: Gen = (r) => {
  const w = 60 + r() * 60;
  const h = w * (1.2 + r() * 0.8);
  const pts: Pt[] = [];
  for (let i = 0; i <= 20; i++) pts.push({ x: 400 - w, y: 400 + h - (h * i) / 20 });
  for (let i = 1; i <= 30; i++) {
    const a = Math.PI + (i / 30) * Math.PI;
    pts.push({ x: 400 + Math.cos(a) * w, y: 400 + Math.sin(a) * w });
  }
  for (let i = 1; i <= 20; i++) pts.push({ x: 400 + w, y: 400 + (h * i) / 20 });
  return rotate(hand(r, pts, 3), r() * 6.28);
};

const shortDash: Gen = (r) => {
  const L = 10 + r() * 30; // < 6% of 800 = 48
  const a = r() * 6.28;
  return Array.from({ length: 8 }, (_, i) => ({ x: 400 + Math.cos(a) * (L * i) / 7, y: 400 + Math.sin(a) * (L * i) / 7 }));
};

function rate(gen: Gen, kinds: StrokeKind[], seed: number): number {
  let ok = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = rng(seed + i * 7919);
    if (kinds.includes(classify(gen(r), MIN_DIM).kind)) ok++;
  }
  return ok / RUNS;
}

describe('classify (docs/02 §4 test set)', () => {
  it('recognises hand-drawn and lopsided circles ≥ 90% of the time', () => {
    expect(rate(circle, ['circle'], 1)).toBeGreaterThanOrEqual(0.9);
  });

  it('takes fish outlines for circles ≤ 10% of the time', () => {
    expect(rate(fishOutline, ['circle'], 2)).toBeLessThanOrEqual(0.1);
    expect(rate(fishOutline, ['elongated'], 2)).toBeGreaterThanOrEqual(0.9);
  });

  it('treats half circles as arcs with a crescent phase', () => {
    expect(rate(halfCircle, ['arc'], 3)).toBeGreaterThanOrEqual(0.9);
    const c = classify(halfCircle(rng(3)), MIN_DIM);
    expect(c.phase).toBe('crescent');
  });

  it('treats S shapes as open curves', () => {
    expect(rate(sShape, ['open'], 4)).toBeGreaterThanOrEqual(0.9);
  });

  it('never takes spirals or U shapes for circles', () => {
    expect(rate(spiral, ['circle'], 5)).toBe(0);
    expect(rate(uShape, ['circle'], 6)).toBe(0);
  });

  it('treats very short strokes as short', () => {
    expect(rate(shortDash, ['short'], 7)).toBe(1);
  });

  it('gives a gibbous phase to nearly closed arcs', () => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * 280 * (Math.PI / 180);
      pts.push({ x: 400 + Math.cos(a) * 100, y: 400 + Math.sin(a) * 100 });
    }
    const c = classify(pts, MIN_DIM);
    // A 280° arc leaves a gap of ~0.36 of the diagonal: not closed.
    expect(c.kind).toBe('arc');
    expect(c.phase).toBe('gibbous');
  });
});

describe('spineFromOutline', () => {
  it('runs along the long axis with the fuller end as the head', () => {
    const pts = fishOutline(rng(11)).map((p) => p);
    const c = classify(pts, MIN_DIM);
    const spine = spineFromOutline(pts, c.features);
    const head = spine[spine.length - 1];
    const tail = spine[0];
    const len = Math.hypot(head.x - tail.x, head.y - tail.y);
    expect(len).toBeGreaterThan(150);
    // The generator puts the head at the -x end before rotation; check the
    // head is the end nearer the outline's widest part.
    const widest = pts.reduce(
      (best, p) => {
        const d = Math.abs((p.x - c.features.centroid.x) * -c.features.axis.y + (p.y - c.features.centroid.y) * c.features.axis.x);
        return d > best.d ? { p, d } : best;
      },
      { p: pts[0], d: -1 },
    ).p;
    expect(Math.hypot(widest.x - head.x, widest.y - head.y)).toBeLessThan(Math.hypot(widest.x - tail.x, widest.y - tail.y));
  });
});
