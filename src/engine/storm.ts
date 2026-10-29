// 雷雨 (docs/02 §5.5): the lightning's shape and its flicker. A near strike
// is two or three bolts at once, each a bright trunk forking again and
// again into finer, fainter branches, with a crawler running along the
// cloud base above them; a far strike only lights the clouds. Either
// flickers: a bright stroke, a weaker one, a strong return, a last faint
// one, then an afterglow. Pure, so the shape and timing can be tested.

/** Most segments the world shader draws for one strike. */
export const MAX_BOLT = 96;

/** A segment from a to b (y up), with its strength 0..1 (trunks 1, fine twigs faint). */
export type Segment = [ax: number, ay: number, bx: number, by: number, strength: number];

interface Walk {
  x: number;
  y: number;
  /** Heading in radians, 0 = straight down. */
  angle: number;
  /** Length still to run, px. */
  left: number;
  strength: number;
  depth: number;
}

/**
 * A strike: `bolts` trunks from the cloud base (`top`) down toward `bottom`
 * around `x`, each forking as it goes, and one crawler along the cloud base.
 * Trunks come first, so the cut at MAX_BOLT drops the finest twigs.
 */
export function strike(x: number, top: number, bottom: number, width: number, S: number, random: () => number, bolts = 2 + Math.floor(random() * 2)): Segment[] {
  const trunks: Segment[] = [];
  const branches: Segment[] = [];
  const step = S * 0.045;
  const roots: number[] = [];
  for (let i = 0; i < bolts; i++) roots.push(Math.min(Math.max(x + (i - (bolts - 1) / 2) * S * (0.35 + 0.2 * random()), S * 0.05), width - S * 0.05));
  // The crawler: along the cloud base from one root past the other.
  const lo = Math.min(...roots) - S * 0.15;
  const hi = Math.max(...roots) + S * 0.15;
  let cx = lo;
  let cy = top - S * 0.02;
  while (cx < hi) {
    const nx = cx + S * (0.07 + 0.05 * random());
    const ny = top - S * (0.01 + 0.05 * random());
    branches.push([cx, cy, nx, ny, 0.55]);
    cx = nx;
    cy = ny;
  }
  const queue: Walk[] = roots.map((rx) => ({ x: rx, y: top, angle: (random() - 0.5) * 0.4, left: top - bottom, strength: 1, depth: 0 }));
  while (queue.length) {
    const w = queue.shift()!;
    // A trunk runs until it strikes; a branch until its length is spent.
    while (w.depth === 0 ? w.y > bottom : w.left > 0) {
      const len = w.depth === 0 ? step * (0.6 + 0.8 * random()) : Math.min(step * (0.6 + 0.8 * random()), w.left);
      // Jagged: each step turns a little, and the trunk keeps heading down.
      w.angle += (random() - 0.5) * 0.9;
      if (w.depth === 0) w.angle *= 0.6;
      const nx = w.x + Math.sin(w.angle) * len;
      const ny = w.depth === 0 ? Math.max(w.y - Math.cos(w.angle) * len, bottom) : w.y - Math.cos(w.angle) * len;
      (w.depth === 0 ? trunks : branches).push([w.x, w.y, nx, ny, w.strength]);
      w.x = nx;
      w.y = ny;
      w.left -= len;
      // Fork: more often high up, finer and fainter each time.
      if (w.depth < 4 && random() < 0.5 - w.depth * 0.09) {
        const side = random() < 0.5 ? -1 : 1;
        queue.push({ x: nx, y: ny, angle: w.angle + side * (0.4 + 0.6 * random()), left: Math.max(w.depth === 0 ? w.y - bottom : w.left, S * 0.1) * (0.45 + 0.35 * random()), strength: w.strength * 0.7, depth: w.depth + 1 });
      }
    }
  }
  return [...trunks, ...branches].slice(0, MAX_BOLT);
}

/**
 * Pack a segment for the shader: four floats per segment, the strength
 * carried in the fraction of a.x (px are whole enough for this).
 */
export function packSegment([ax, ay, bx, by, strength]: Segment): [number, number, number, number] {
  return [Math.floor(ax) + Math.min(Math.max(strength, 0), 1) * 0.9, ay, bx, by];
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
