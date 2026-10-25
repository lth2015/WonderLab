// Gesture classification: docs/02-product-design.md §4 (the table) with
// thresholds from docs/03-ux-ui-design.md §6.2. Pure functions, no three.js,
// so the test cases in classify.test.ts can run in Node.

export interface Pt {
  x: number;
  y: number;
}

export interface Thresholds {
  shortStroke: number;
  closeGap: number;
  closeTurn: number;
  maxAspect: number;
  maxResidual: number;
  arcMinTurn: number;
  gibbousTurn: number;
}

export const THRESHOLDS: Thresholds = {
  shortStroke: 0.06,   // path length, fraction of the short screen edge
  closeGap: 0.25,      // end-to-end distance, fraction of the bbox diagonal
  closeTurn: 330,      // degrees of accumulated turning that also counts as closed
  maxAspect: 1.6,      // long / short side, along the stroke's own axes
  maxResidual: 0.18,   // circle fit RMS error, fraction of the radius
  arcMinTurn: 150,
  gibbousTurn: 240,
};

/** short: #3 · circle: #4 · elongated: #5 · arc: #6 · open: #7 */
export type StrokeKind = 'short' | 'circle' | 'elongated' | 'arc' | 'open';

export interface CircleFit {
  cx: number;
  cy: number;
  r: number;
  residual: number; // RMS distance from the circle, in radii
}

export interface Features {
  length: number;
  turn: number;      // |net turning| in degrees
  sweep: number;     // degrees swept around the fitted circle's centre
  gap: number;       // end-to-end distance / bbox diagonal
  aspect: number;    // principal-axis extent ratio, >= 1
  fit: CircleFit;
  centroid: Pt;
  axis: Pt;          // unit vector of the long axis
}

export interface Classification {
  kind: StrokeKind;
  features: Features;
  /** Moon phase for #4 / #6: 'full' | 'gibbous' | 'crescent'. */
  phase?: MoonPhase;
}

export type MoonPhase = 'full' | 'gibbous' | 'crescent';

export function classify(points: Pt[], minDim: number, T: Thresholds = THRESHOLDS): Classification {
  return decide(measureStroke(points), minDim, T);
}

/** The shape of a stroke, which does not depend on any threshold. */
export function measureStroke(points: Pt[]): Features {
  return measure(points, pathLength(points));
}

/**
 * The docs/02 §4 table applied to measured features. Separate from
 * measuring so a threshold sweep (src/collect/calibrate.ts) measures each
 * stroke once.
 */
export function decide(features: Features, minDim: number, T: Thresholds = THRESHOLDS): Classification {
  if (features.length < minDim * T.shortStroke) return { kind: 'short', features };

  const fitsCircle = features.fit.residual < T.maxResidual;
  // How far round the stroke goes. For a stroke that fits a circle, the
  // angle swept about its centre, which a trembling hand barely moves; for
  // anything else (an S, a spiral) the turning of the path itself.
  const bend = fitsCircle ? features.sweep : features.turn;
  const closed = features.gap < T.closeGap || bend >= T.closeTurn;
  if (closed) {
    if (fitsCircle && features.aspect <= T.maxAspect) return { kind: 'circle', features, phase: 'full' };
    return { kind: 'elongated', features };
  }
  if (bend >= T.arcMinTurn && fitsCircle) {
    return { kind: 'arc', features, phase: bend >= T.gibbousTurn ? 'gibbous' : 'crescent' };
  }
  return { kind: 'open', features };
}

export function pathLength(points: Pt[]): number {
  let L = 0;
  for (let i = 1; i < points.length; i++) L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return L;
}

/** Evenly spaced points along the path, which keeps hand jitter out of the turn sum. */
export function resample(points: Pt[], n: number, length = pathLength(points)): Pt[] {
  if (points.length < 2 || length === 0) return points.map((p) => ({ x: p.x, y: p.y }));
  const step = length / (n - 1);
  const out: Pt[] = [{ x: points[0].x, y: points[0].y }];
  let acc = 0;
  let target = step;
  for (let i = 1; i < points.length && out.length < n; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    while (d > 0 && acc + d >= target && out.length < n) {
      const t = (target - acc) / d;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      target += step;
    }
    acc += d;
  }
  const last = points[points.length - 1];
  while (out.length < n) out.push({ x: last.x, y: last.y });
  return out;
}

function measure(points: Pt[], length: number): Features {
  const pts = resample(points, 64, length);
  const n = pts.length;

  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;

  // Principal axes, for an aspect ratio that does not depend on rotation.
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ax = { x: Math.cos(angle), y: Math.sin(angle) };
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const u = dx * ax.x + dy * ax.y;
    const v = -dx * ax.y + dy * ax.x;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const extU = maxU - minU;
  const extV = maxV - minV;
  const aspect = Math.max(extU, extV) / Math.max(Math.min(extU, extV), 1e-6);
  const axis = extU >= extV ? ax : { x: -ax.y, y: ax.x };

  const turn = netTurn(points, length);

  const fit = fitCircle(pts, cx, cy);
  // Unwrapped angle about the fitted centre, from the first point to the last.
  let sweep = 0;
  for (let i = 1; i < n; i++) {
    const a1 = Math.atan2(pts[i - 1].y - fit.cy, pts[i - 1].x - fit.cx);
    const a2 = Math.atan2(pts[i].y - fit.cy, pts[i].x - fit.cx);
    sweep += angleDiff(a2, a1);
  }

  const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
  const gap = Math.hypot(pts[n - 1].x - pts[0].x, pts[n - 1].y - pts[0].y) / diag;

  return {
    length,
    turn: Math.abs(turn) * (180 / Math.PI),
    gap,
    aspect,
    fit,
    sweep: Math.abs(sweep) * (180 / Math.PI),
    centroid: { x: cx, y: cy },
    axis,
  };
}

/** Points at least this far apart when summing turns, in px. */
const TURN_SPACING = 4;

/**
 * Net turning along the stroke, in radians.
 *
 * Measured on a coarser, lightly smoothed copy of the path. At the slow
 * ends of a stroke the hand moves less per frame than it trembles, so the
 * raw path zigzags back and forth; summed point to point, those zigzags read
 * as turns (and a reversal as ±180°), which made clean half circles read as
 * nearly straight and U shapes as closed. Spacing the points at least a few
 * pixels apart and averaging neighbours keeps the tremor out of the sum
 * while leaving the shape's own bends in it.
 */
function netTurn(points: Pt[], length: number): number {
  const n = Math.max(8, Math.min(64, Math.round(length / TURN_SPACING) + 1));
  const raw = resample(points, n, length);
  const pts = raw.map((p, i) => {
    if (i === 0 || i === raw.length - 1) return p;
    const a = raw[i - 1];
    const b = raw[i + 1];
    return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 };
  });
  let turn = 0;
  for (let i = 2; i < pts.length; i++) {
    const a1 = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
    const a2 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    turn += angleDiff(a2, a1);
  }
  return turn;
}

/** Algebraic (Kåsa) least-squares circle fit. */
export function fitCircle(pts: Pt[], mx = 0, my = 0): CircleFit {
  // Solve for the centre (a, b) and c in x² + y² = 2ax + 2by + c, with
  // coordinates relative to (mx, my) for numerical stability.
  let suu = 0, svv = 0, suv = 0, su = 0, sv = 0, suz = 0, svz = 0, sz = 0;
  const n = pts.length;
  for (const p of pts) {
    const u = p.x - mx;
    const v = p.y - my;
    const z = u * u + v * v;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    su += u;
    sv += v;
    suz += u * z;
    svz += v * z;
    sz += z;
  }
  // Normal equations for [2a, 2b, c].
  const M = [
    [suu, suv, su],
    [suv, svv, sv],
    [su, sv, n],
  ];
  const rhs = [suz, svz, sz];
  const sol = solve3(M, rhs);
  if (!sol) return { cx: mx, cy: my, r: 0, residual: Infinity };
  const a = sol[0] / 2;
  const b = sol[1] / 2;
  const r = Math.sqrt(Math.max(sol[2] + a * a + b * b, 0));
  let err = 0;
  for (const p of pts) {
    const d = Math.hypot(p.x - mx - a, p.y - my - b) - r;
    err += d * d;
  }
  return { cx: mx + a, cy: my + b, r, residual: r > 0 ? Math.sqrt(err / n) / r : Infinity };
}

function solve3(M: number[][], y: number[]): number[] | null {
  const A = M.map((row, i) => [...row, y[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-9) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
}

/**
 * A fish spine for a closed elongated outline (#5): the long axis through
 * the centroid, ordered tail first. The wider end becomes the head.
 */
export function spineFromOutline(points: Pt[], f: Features, n = 24): Pt[] {
  const { centroid: c, axis } = f;
  let minU = Infinity;
  let maxU = -Infinity;
  for (const p of points) {
    const u = (p.x - c.x) * axis.x + (p.y - c.y) * axis.y;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
  }
  // Compare the body's width near each end.
  const span = maxU - minU || 1;
  let lo = 0;
  let hi = 0;
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const u = (dx * axis.x + dy * axis.y - minU) / span;
    const v = Math.abs(-dx * axis.y + dy * axis.x);
    if (u > 0.15 && u < 0.4) lo = Math.max(lo, v);
    if (u > 0.6 && u < 0.85) hi = Math.max(hi, v);
  }
  const [from, to] = hi >= lo ? [minU, maxU] : [maxU, minU];
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = from + ((to - from) * i) / (n - 1);
    out.push({ x: c.x + axis.x * u, y: c.y + axis.y * u });
  }
  return out;
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
