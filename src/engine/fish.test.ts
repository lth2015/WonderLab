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
