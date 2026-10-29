// 雷雨 (docs/02 §5.5): the lightning's shape and its flicker. A near strike
// is a bolt you can see, jagged, with a branch, from the clouds down onto
// the far hills; a far one only lights the clouds. Either flickers: a
// bright stroke, a weaker one, a strong return, a last faint one, then an
// afterglow. Pure, so the shape and timing can be tested.

/** Most segments the world shader draws for one bolt (main path and branch). */
export const MAX_BOLT = 24;

export type Segment = [ax: number, ay: number, bx: number, by: number];

/**
 * A bolt from (x, top) down to (x + drift, bottom), y up: the main path in
 * `steps` jagged segments and one branch leaving it partway down.
 */
export function boltPath(x: number, top: number, bottom: number, S: number, random: () => number, steps = 15): Segment[] {
  const pts: [number, number][] = [];
  const drift = (random() - 0.5) * S * 0.35;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    // Larger jags in the middle, the ends pinned.
    const jag = i === 0 || i === steps ? 0 : (random() - 0.5) * S * 0.07 * Math.sin(Math.PI * u + 0.3);
    pts.push([x + drift * u + jag, top + (bottom - top) * u]);
  }
  const segs: Segment[] = [];
  for (let i = 0; i < steps; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
  // The branch: from a third to two thirds of the way down, off to one side, shorter.
  const from = Math.floor(steps * (0.3 + 0.35 * random()));
  const side = random() < 0.5 ? -1 : 1;
  let [bx, by] = pts[from];
  const branchSteps = Math.min(6, MAX_BOLT - segs.length);
  const len = (top - bottom) * (0.25 + 0.15 * random());
  for (let i = 0; i < branchSteps; i++) {
    const nx = bx + side * S * (0.02 + 0.03 * random());
    const ny = by - len / branchSteps;
    segs.push([bx, by, nx, ny]);
    bx = nx;
    by = ny;
  }
  return segs.slice(0, MAX_BOLT);
}

/** Strokes of one flash: [seconds after it starts, brightness]. */
const STROKES: [number, number][] = [
  [0, 1],
  [0.07, 0.45],
  [0.19, 0.9],
  [0.34, 0.35],
];

/** How bright the flash is `a` seconds after it starts, 0..1: sharp strokes, then a fading afterglow. */
export function flashLevel(a: number): number {
  if (a < 0 || a > 1.5) return 0;
  let v = 0;
  for (const [at, amp] of STROKES) if (a >= at) v = Math.max(v, amp * Math.exp(-(a - at) * 28));
  return Math.min(1, v + 0.22 * Math.exp(-a * 3.5));
}
