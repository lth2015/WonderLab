import { describe, expect, it } from 'vitest';
import { Atmosphere } from './atmosphere';
import { Fish, FORM_TIME } from './fish';
import { perimeter, RELATIONS, ringFor, ringOffset, type Orbit } from './relations';

// The swimming behaviour, run without a renderer: fish are plain geometry
// and shader uniforms until something draws them.

const W = 1280;
const lakeTop = 360;
const bounds = { minX: 0, maxX: W, minY: 0, maxY: lakeTop };
const palette = new Atmosphere().palette;

function drawn(x: number, y: number, dir = 1): Fish {
  const pts = Array.from({ length: 25 }, (_, i) => ({ x: x + dir * i * 7, y: y + 12 * Math.sin((i / 24) * Math.PI), t: i * 20, pressure: 0.5 }));
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return new Fish(pts, length, 480, 800, palette);
}

function run(fish: Fish[], seconds: number, t0 = 0): number {
  const dt = 1 / 30;
  let time = t0;
  const ctx = { time, bounds, others: fish, ripple: () => {} };
  for (let k = 0; k < seconds / dt; k++) {
    time += dt;
    ctx.time = time;
    for (const f of fish) f.update(dt, ctx);
  }
  return time;
}

describe('fish in a ring (群鱼成圆)', () => {
  it('gather on the circle within the ring’s time', () => {
    const fish = [drawn(150, 80), drawn(900, 300, -1), drawn(500, 60), drawn(1100, 100, -1), drawn(300, 280)];
    let t = run(fish, FORM_TIME + 0.2);
    const at = ringFor(fish.length, Math.max(...fish.map((f) => f.L)), bounds, 800, null)!;
    const L = Math.max(...fish.map((f) => f.L));
    const orbit: Orbit = { ...at, dir: 1, until: t + RELATIONS.ringTime, start: t, phase: 0, omega: (0.65 * L * 2 * Math.PI) / perimeter(at.rx, at.ry), slots: fish.length };
    fish.forEach((f, i) => f.setOrbit(orbit, i));
    t = run(fish, RELATIONS.ringTime * 0.6, t);
    const close = fish.filter((f) => ringOffset(orbit, f.headX, f.headY) < RELATIONS.ringTolerance).length;
    expect(close / fish.length).toBeGreaterThanOrEqual(RELATIONS.ringFormedShare);
    // Spread out, not bunched: every pair of heads at least half a length apart.
    for (let i = 0; i < fish.length; i++)
      for (let j = i + 1; j < fish.length; j++) expect(Math.hypot(fish[i].headX - fish[j].headX, fish[i].headY - fish[j].headY)).toBeGreaterThan(L * 0.5);
  });

  it('let go when the ring ends', () => {
    const f = drawn(300, 100);
    let t = run([f], FORM_TIME + 0.2);
    f.setOrbit({ cx: 640, cy: 180, rx: 200, ry: 110, dir: -1, until: t + 2, start: t, phase: 0, omega: 0.5, slots: 1 });
    t = run([f], 1, t);
    expect(f.orbiting).toBe(true);
    run([f], 1.5, t);
    expect(f.orbiting).toBe(false);
  });
});

describe('growing with time (docs/02 §5.6)', () => {
  const spine = (len: number) => Array.from({ length: 20 }, (_, i) => ({ x: 100 + (len * i) / 19, y: 100, t: i * 10, pressure: 0.5 }));

  it('a newly drawn fish is held to the size limits, then grown by its age', () => {
    const young = new Fish(spine(400), 400, 300, 800, palette);
    const old = new Fish(spine(400), 400, 300, 800, palette, { growth: 1.18 });
    expect(young.L).toBeCloseTo(800 * 0.26);
    expect(old.L).toBeCloseTo(800 * 0.26 * 1.18);
  });

  it('a restored fish keeps the length it had grown to, and only adds what the days since have added', () => {
    const grown = 800 * 0.26 * 1.1;
    const back = new Fish(spine(grown), grown, 300, 800, palette, { restored: true, growth: 1.02 });
    expect(back.L).toBeCloseTo(grown * 1.02);
  });
});

describe('a saved fish comes back the same length (docs/02 §11 decision 12)', () => {
  const plen = (p: { x: number; y: number }[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0);

  it('made again and again from its saved body, swimming or not, it neither shrinks nor grows', () => {
    let pts = Array.from({ length: 12 }, (_, i) => ({ x: 300 + i * 13.5, y: 200 + 6 * Math.sin(i / 3), t: 0, pressure: 0.5 }));
    const first = plen(pts);
    for (let round = 0; round < 20; round++) {
      const f = new Fish(pts, plen(pts), 200, 800, palette, { restored: true });
      // Every other time it is saved before it has swum at all (opened and closed at once).
      if (round % 2) run([f], 2);
      pts = f.spineFromTail().map((p) => ({ ...p, t: 0, pressure: 0.5 }));
      // Resampling a curve may shave a hair off its bends, never a whole step: under 0.1% after twenty saves.
      expect(Math.abs(plen(pts) / first - 1)).toBeLessThan(0.001);
    }
  });
});

