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
  grow(queue, trunks, branches, bottom, S, random);
  return [...trunks, ...branches].slice(0, MAX_BOLT);
}

/**
 * A strike the visitor drew (雷雨, docs/02 §5.5): the trunk follows the
 * stroke from its higher end, made jagged, forking as it goes, and runs
 * on down to `bottom` if the stroke stopped short of the hills.
 */
export function strikeAlong(path: { x: number; y: number }[], bottom: number, S: number, random: () => number): Segment[] {
  const trunks: Segment[] = [];
  const branches: Segment[] = [];
  const queue: Walk[] = [];
  const pts = path[0].y >= path[path.length - 1].y ? path : [...path].reverse();
  const step = S * 0.045;
  // Nodes along the stroke, a step apart, each pushed a little to the side.
  const nodes: { x: number; y: number }[] = [{ ...pts[0] }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc < step * (0.6 + 0.8 * random()) && i < pts.length - 1) continue;
    acc = 0;
    const j = (random() - 0.5) * S * 0.03;
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const d = Math.hypot(dx, dy) || 1;
    nodes.push({ x: pts[i].x - (dy / d) * j, y: Math.max(pts[i].y + (dx / d) * j, bottom) });
  }
  let angle = 0;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    trunks.push([a.x, a.y, b.x, b.y, 1]);
    angle = Math.atan2(b.x - a.x, a.y - b.y);
    if (random() < 0.4) {
      const side = random() < 0.5 ? -1 : 1;
      queue.push({ x: b.x, y: b.y, angle: angle + side * (0.4 + 0.6 * random()), left: Math.max(b.y - bottom, S * 0.1) * (0.3 + 0.35 * random()), strength: 0.7, depth: 1 });
    }
  }
  const end = nodes[nodes.length - 1];
  // Stopped short of the hills: the lightning carries on down by itself.
  if (end.y > bottom + S * 0.02) queue.unshift({ x: end.x, y: end.y, angle: Math.max(Math.min(angle, 0.6), -0.6), left: end.y - bottom, strength: 1, depth: 0 });
  grow(queue, trunks, branches, bottom, S, random);
  return [...trunks, ...branches].slice(0, MAX_BOLT);
}

/** Walk each bolt in the queue down, jagged, forking into finer and fainter branches. */
function grow(queue: Walk[], trunks: Segment[], branches: Segment[], bottom: number, S: number, random: () => number): void {
  const step = S * 0.045;
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
