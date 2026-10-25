// 笔性 (docs/02 §5.1): what kind of stroke made a fish, and the koi variety
// it leans toward. The stroke sets the tendency; chance keeps the surprise:
// three times in four the fish comes from its stroke's family, otherwise
// from any other variety. Liveliness and temperament are separate (fish.ts),
// so a kohaku can be calm and a sumi lively.
//
// Measures are normalised so the same hand gives the same reading anywhere:
// speed in short screen edges per second over a coarse resample (a 240 Hz
// pen and a 60 Hz mouse trace the same path), bend on a coarse smoothed
// path so tremor does not count as curving. Fast and slow split per pointer type, since a finger moves
// differently from a mouse; the splits are first-round values, to be set
// from collected strokes (npm run calibrate).

export type Family = 'brisk' | 'lively' | 'calm' | 'round';

/** Fast·straight, fast·curvy, slow·straight, slow·curvy. */
export const FAMILIES: Record<Family, readonly string[]> = {
  brisk: ['kohaku', 'tancho'],
  lively: ['sanke', 'showa'],
  calm: ['asagi', 'sumi'],
  round: ['ogon'],
};

export const VARIETIES: readonly string[] = Object.values(FAMILIES).flat();

export const STYLE = {
  /** Chance the variety comes from the stroke's own family. */
  familyChance: 0.75,
  /**
   * Short screen edges per second at which a stroke counts as fast. First
   * round, from synthetic strokes; replace with the medians from real ones
   * (npm run calibrate, 「笔性分界」).
   */
  fastSplit: { mouse: 0.5, touch: 0.8, pen: 0.7 } as Record<string, number>,
  /** Bend (total turn over π, smoothed) above which a stroke counts as curvy: about a right angle. */
  curvySplit: 0.5,
};

export interface StrokeStyle {
  /** Short screen edges per second. */
  speed: number;
  /** Total turn over π. */
  curviness: number;
  family: Family;
}

type P = { x: number; y: number; t?: number };

export function pathLength(pts: P[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}

/** n points evenly spaced along the path. */
export function resampleEven(pts: P[], n: number): { x: number; y: number }[] {
  const L = pathLength(pts);
  if (pts.length < 2 || L <= 0) return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
  const out = [{ x: pts[0].x, y: pts[0].y }];
  const step = L / (n - 1);
  let target = step;
  let acc = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= target && out.length < n) {
      const k = (target - acc) / (d || 1);
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      target += step;
    }
    acc += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out;
}

/** n points evenly spaced along a timed path, each with the time the hand passed it. */
export function resampleTimed(pts: Required<P>[], n: number): { x: number; y: number; t: number }[] {
  const L = pathLength(pts);
  if (pts.length < 2 || L <= 0) return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y, t: pts[0].t }));
  const out = [{ x: pts[0].x, y: pts[0].y, t: pts[0].t }];
  const step = L / (n - 1);
  let target = step;
  let acc = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc + d >= target && out.length < n) {
      const k = (target - acc) / (d || 1);
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, t: a.t + (b.t - a.t) * k });
      target += step;
    }
    acc += d;
  }
  const last = pts[pts.length - 1];
  while (out.length < n) out.push({ x: last.x, y: last.y, t: last.t });
  return out;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function totalTurn(pts: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 2; i < pts.length; i++) {
    const a1 = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
    const a2 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    sum += Math.abs(angleDiff(a2, a1));
  }
  return sum;
}

export function familyOf(speed: number, curviness: number, pointerType: string): Family {
  const fast = speed >= (STYLE.fastSplit[pointerType] ?? STYLE.fastSplit.mouse);
  const curvy = curviness >= STYLE.curvySplit;
  return fast ? (curvy ? 'lively' : 'brisk') : curvy ? 'round' : 'calm';
}

/**
 * How much a stroke bends, in radians: every turn counts, both ways (an S
 * bends a lot), but measured on a coarse, smoothed path so the hand's tremor
 * does not add up to a curve.
 */
export function bend(points: P[]): number {
  let pts = resampleEven(points, 24);
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : { x: (pts[i - 1].x + 2 * p.x + pts[i + 1].x) / 4, y: (pts[i - 1].y + 2 * p.y + pts[i + 1].y) / 4 }));
  }
  return totalTurn(pts);
}

/** Read a stroke's style. Points carry t in ms. */
export function strokeStyle(points: Required<P>[], minDim: number, pointerType: string): StrokeStyle {
  // Speed over a coarse path: sampling jitter adds length on fast devices.
  const coarse = resampleEven(points, Math.max(2, Math.min(64, Math.round(pathLength(points) / (minDim * 0.01)) + 1)));
  const seconds = Math.max((points[points.length - 1].t - points[0].t) / 1000, 0.05);
  const speed = pathLength(coarse) / Math.max(minDim, 1) / seconds;
  const curviness = Math.min(bend(points) / Math.PI, 4);
  return { speed, curviness, family: familyOf(speed, curviness, pointerType) };
}

/**
 * Which variety a fish of `family` becomes. `available` limits the choice
 * to the skins that loaded (none: any of them, for the procedural koi).
 */
export function pickVariety(family: Family, random: () => number, available: readonly string[] = VARIETIES): { variety: string; inFamily: boolean } {
  const pool = available.length ? available : VARIETIES;
  const own = FAMILIES[family].filter((v) => pool.includes(v));
  const others = pool.filter((v) => !own.includes(v));
  const inFamily = own.length > 0 && (others.length === 0 || random() < STYLE.familyChance);
  const from = inFamily ? own : others;
  return { variety: from[Math.floor(random() * from.length) % from.length], inFamily };
}

/** For the procedural koi (no painted skins): how much cinnabar a variety carries. */
export function patchFor(variety: string, random: () => number): number {
  if (variety === 'asagi' || variety === 'sumi' || variety === 'ogon') return 0;
  return 0.5 + random() * 0.5;
}

/**
 * Which fish leave when there are more than `max`: the oldest first, never
 * the first fish (本命鱼). `fish` is oldest first.
 */
export function overflowing<T extends { honmei: boolean }>(fish: T[], max: number): T[] {
  let over = fish.length - max;
  const out: T[] = [];
  for (const f of fish) {
    if (over <= 0) break;
    if (f.honmei) continue;
    out.push(f);
    over--;
  }
  return out;
}
