// Human-like synthetic strokes for the docs/02 §4 test set: what a hand does
// that a perfect generator does not — circles that overshoot or stop short
// of closing, a radius that wanders, a little tremor, a hook at the start or
// the end, slow ends and a fast middle — on desktop and phone sizes. Seeded,
// so every run draws the same strokes.
//
// A stand-in until real strokes arrive (strokes/*.json): good for finding
// where the thresholds are fragile, never a reason to tune them on its own.

import { CATEGORIES, REPS, type Sample, type Session } from './protocol';

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const between = (r: Rand, a: number, b: number) => a + (b - a) * r();
const gauss = (r: Rand) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

/** A path as a function of u in 0..1, in units of the shape's size. */
type Path = (u: number) => [number, number];

function circlePath(r: Rand, aspect: number, sweepDeg: number, wobble: number): Path {
  const start = between(r, 0, Math.PI * 2);
  const dir = r() < 0.5 ? 1 : -1;
  const rot = between(r, 0, Math.PI);
  const ph = between(r, 0, Math.PI * 2);
  const sweep = (sweepDeg * Math.PI) / 180;
  return (u) => {
    const a = start + dir * sweep * u;
    const rr = 1 + wobble * Math.sin(2 * a + ph) + wobble * 0.5 * Math.sin(3 * a + 2 * ph);
    const x = Math.cos(a) * rr * aspect;
    const y = Math.sin(a) * rr;
    return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
  };
}

function fishPath(r: Rand): Path {
  // Body from the nose round one side to the tail fork and back along the
  // other: a long ellipse with a notch at the tail.
  const L = between(r, 2.2, 3.4);
  const rot = between(r, -0.6, 0.6);
  const dir = r() < 0.5 ? 1 : -1;
  return (u) => {
    const a = Math.PI * 2 * u;
    let x = Math.cos(a) * L;
    let y = Math.sin(a) * dir;
    // The tail end (x near -L) pinches in and flares into a fork.
    const tail = Math.max(0, -Math.cos(a));
    y *= 1 - 0.75 * tail ** 2 + 0.9 * tail ** 6;
    x -= 0.35 * tail ** 6 * L;
    return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
  };
}

function sPath(r: Rand): Path {
  // Top to bottom, swinging one way and then the other.
  const flip = r() < 0.5 ? 1 : -1;
  const swing = between(r, 0.5, 0.8);
  return (u) => [-flip * Math.sin(2 * Math.PI * u) * swing, -1 + 2 * u];
}

function spiralPath(r: Rand): Path {
  const turns = between(r, 1.8, 3);
  const dir = r() < 0.5 ? 1 : -1;
  return (u) => {
    const a = dir * turns * Math.PI * 2 * u;
    const rr = 0.15 + 0.85 * u;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  };
}

function uPath(r: Rand): Path {
  const deep = between(r, 0.6, 1.4);
  return (u) => {
    // Down the left arm, round the bottom, up the right arm.
    if (u < 0.3) return [-1, -deep + (u / 0.3) * deep];
    if (u > 0.7) return [1, -((u - 0.7) / 0.3) * deep];
    const a = Math.PI - ((u - 0.3) / 0.4) * Math.PI;
    return [Math.cos(a), Math.sin(a) * 0.9];
  };
}

function dashPath(r: Rand): Path {
  const ang = between(r, 0, Math.PI * 2);
  const bend = between(r, -0.15, 0.15);
  return (u) => [Math.cos(ang) * u + bend * Math.sin(Math.PI * u) * -Math.sin(ang), Math.sin(ang) * u + bend * Math.sin(Math.PI * u) * Math.cos(ang)];
}

/** Sample a path the way a hand travels it: slow ends, tremor, maybe a hook. */
function draw(r: Rand, path: Path, size: number, cx: number, cy: number, ms: number, hook: boolean): [number, number, number][] {
  const n = Math.max(12, Math.round(ms / 16));
  const pts: [number, number, number][] = [];
  const tremor = between(r, 0.3, 1.0);
  let drift = 0;
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    // Ease in and out: the hand starts and stops slowly.
    const u = s - Math.sin(2 * Math.PI * s) / (2 * Math.PI);
    const [px, py] = path(u);
    drift += gauss(r) * 0.15;
    pts.push([cx + px * size + gauss(r) * tremor + drift, cy + py * size + gauss(r) * tremor - drift, Math.round(s * ms)]);
  }
  if (hook) {
    // A small flick at the end, as a pen lifts.
    const [x1, y1] = pts[pts.length - 2];
    const [x2, y2, t2] = pts[pts.length - 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const k = (size * 0.08) / (Math.hypot(dx, dy) || 1);
    for (let j = 1; j <= 3; j++) pts.push([x2 - dy * k * j * 0.4 + dx * k * j * 0.3, y2 + dx * k * j * 0.4 + dy * k * j * 0.3, t2 + j * 16]);
  }
  return pts;
}

function stroke(r: Rand, category: string, W: number, H: number): [number, number, number][] {
  // On a phone people draw shapes large relative to the screen; a dash or a
  // tap is about the same size anywhere.
  const S = Math.min(W, H) * (W < 600 && category !== 'dash' ? 1.9 : 1);
  const cx = between(r, 0.3, 0.7) * W;
  const cy = between(r, 0.35, 0.75) * H;
  const hook = r() < 0.25;
  switch (category) {
    case 'circle': {
      const sweep = 360 + between(r, -40, 45);
      return draw(r, circlePath(r, between(r, 1, 1.18), sweep, between(r, 0.02, 0.07)), between(r, 0.05, 0.13) * S, cx, cy, between(r, 450, 900), hook);
    }
    case 'wonky': {
      const sweep = 360 + between(r, -35, 50);
      return draw(r, circlePath(r, between(r, 1.18, 1.5), sweep, between(r, 0.05, 0.11)), between(r, 0.05, 0.12) * S, cx, cy, between(r, 400, 850), hook);
    }
    case 'half':
      return draw(r, circlePath(r, between(r, 1, 1.2), between(r, 160, 215), between(r, 0.02, 0.06)), between(r, 0.06, 0.13) * S, cx, cy, between(r, 300, 600), hook);
    case 'fish':
      return draw(r, fishPath(r), between(r, 0.04, 0.07) * S, cx, cy, between(r, 900, 1600), false);
    case 's':
      return draw(r, sPath(r), between(r, 0.05, 0.1) * S, cx, cy, between(r, 450, 900), hook);
    case 'spiral':
      return draw(r, spiralPath(r), between(r, 0.06, 0.12) * S, cx, cy, between(r, 900, 1800), false);
    case 'u':
      return draw(r, uPath(r), between(r, 0.05, 0.1) * S, cx, cy, between(r, 400, 800), hook);
    case 'dash':
      return draw(r, dashPath(r), between(r, 0.025, 0.05) * S, cx, cy, between(r, 80, 200), false);
    case 'tap': {
      const t = between(r, 60, 260);
      return [
        [cx, cy, 0],
        [cx + gauss(r) * 1.2, cy + gauss(r) * 1.2, Math.round(t)],
      ];
    }
    default:
      throw new Error(`unknown category ${category}`);
  }
}

/** One tester's full session, as ?collect would export it. */
export function syntheticSession(seed: number, device: 'desktop' | 'phone'): Session {
  const r = seededRandom(seed);
  const [W, H] = device === 'phone' ? [390, 844] : [1280, 800];
  const samples: Sample[] = [];
  for (const c of CATEGORIES) {
    for (let rep = 0; rep < REPS; rep++) {
      samples.push({ category: c.id, rep, points: stroke(r, c.id, W, H), width: W, height: H, pointerType: device === 'phone' ? 'touch' : 'mouse' });
    }
  }
  return { version: 1, tester: `synthetic-${seed}`, device, startedAt: '2026-10-25T00:00:00Z', samples };
}

/** The docs/02 §4 plan: ten testers, half on phones. */
export function syntheticStudy(testers = 10, seed = 2026): Session[] {
  return Array.from({ length: testers }, (_, i) => syntheticSession(seed + i * 101, i % 2 ? 'phone' : 'desktop'));
}
