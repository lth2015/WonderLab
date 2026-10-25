// Calibrating the docs/03 §6.2 thresholds against strokes people actually
// drew (strokes/*.json from ?collect). Each stroke is measured once; any set
// of thresholds can then be scored against the docs/02 §5.2 acceptance:
// hand-drawn circles read as circles ≥ 90% of the time, fish outlines read
// as circles ≤ 10%, spirals and U shapes never. The sweep only suggests: a
// person reads the report and changes THRESHOLDS (and 03 §6.2) by hand.

import { decide, measureStroke, THRESHOLDS, type Features, type Thresholds } from '../engine/classify';
import { familyOf, STYLE, strokeStyle, type Family } from '../engine/koi-style';
import { CATEGORIES, LONG_PRESS_MS, TAP_MOVE, type Outcome, type Sample } from './protocol';

export const ACCEPTANCE = { circleRate: 0.9, fishAsCircle: 0.1 };

export interface Measured {
  sample: Sample;
  minDim: number;
  /** Set for a tap or press, which no threshold here can change. */
  fixed: Outcome | null;
  features: Features | null;
}

export function measureAll(samples: Sample[]): Measured[] {
  return samples.map((sample) => {
    const pts = sample.points;
    const [x0, y0] = pts[0];
    let moved = 0;
    for (const [x, y] of pts) moved = Math.max(moved, Math.hypot(x - x0, y - y0));
    const minDim = Math.min(sample.width, sample.height);
    if (moved < TAP_MOVE) {
      return { sample, minDim, fixed: pts[pts.length - 1][2] >= LONG_PRESS_MS ? 'press' : 'tap', features: null };
    }
    return { sample, minDim, fixed: null, features: measureStroke(pts.map(([x, y]) => ({ x, y }))) };
  });
}

export function outcomeOf(m: Measured, T: Thresholds): Outcome {
  return m.fixed ?? decide(m.features!, m.minDim, T).kind;
}

export interface CategoryResult {
  id: string;
  label: string;
  total: number;
  correct: number;
  outcomes: Partial<Record<Outcome, number>>;
}

export interface Miss {
  category: string;
  outcome: Outcome;
  tester?: string;
  pointerType: string;
  features: Features | null;
}

export interface Evaluation {
  categories: CategoryResult[];
  total: number;
  correct: number;
  /** Hand-drawn and lopsided circles read as circles. NaN without any. */
  circleRate: number;
  /** Fish outlines read as circles. NaN without any. */
  fishAsCircle: number;
  /** Spirals and U shapes read as circles: must be zero. */
  spiralOrUAsCircle: number;
  meetsAcceptance: boolean;
  misses: Miss[];
}

export function evaluate(measured: Measured[], T: Thresholds = THRESHOLDS, tester?: (m: Measured) => string): Evaluation {
  const categories: CategoryResult[] = CATEGORIES.map((c) => ({ id: c.id, label: c.label, total: 0, correct: 0, outcomes: {} }));
  const misses: Miss[] = [];
  let circles = 0;
  let circlesHit = 0;
  let fish = 0;
  let fishCircle = 0;
  let spiralOrUCircle = 0;
  for (const m of measured) {
    const cat = CATEGORIES.find((c) => c.id === m.sample.category);
    const row = categories.find((r) => r.id === m.sample.category);
    if (!cat || !row) continue;
    const out = outcomeOf(m, T);
    row.total++;
    row.outcomes[out] = (row.outcomes[out] ?? 0) + 1;
    if (cat.accept.includes(out)) row.correct++;
    else misses.push({ category: cat.id, outcome: out, tester: tester?.(m), pointerType: m.sample.pointerType, features: m.features });
    if (cat.id === 'circle' || cat.id === 'wonky') {
      circles++;
      if (out === 'circle') circlesHit++;
    }
    if (cat.id === 'fish') {
      fish++;
      if (out === 'circle') fishCircle++;
    }
    if ((cat.id === 'spiral' || cat.id === 'u') && out === 'circle') spiralOrUCircle++;
  }
  const circleRate = circles ? circlesHit / circles : NaN;
  const fishAsCircle = fish ? fishCircle / fish : NaN;
  const total = categories.reduce((s, r) => s + r.total, 0);
  return {
    categories,
    total,
    correct: categories.reduce((s, r) => s + r.correct, 0),
    circleRate,
    fishAsCircle,
    spiralOrUAsCircle: spiralOrUCircle,
    meetsAcceptance:
      !(circleRate < ACCEPTANCE.circleRate) && !(fishAsCircle > ACCEPTANCE.fishAsCircle) && spiralOrUCircle === 0,
    misses,
  };
}

/** Values tried for each threshold the drawings can move. */
export const SWEEP: Partial<Record<keyof Thresholds, number[]>> = {
  closeGap: [0.15, 0.2, 0.25, 0.3, 0.35],
  closeTurn: [300, 315, 330, 345],
  maxAspect: [1.3, 1.45, 1.6, 1.8, 2.0],
  maxResidual: [0.12, 0.15, 0.18, 0.22, 0.26],
  arcMinTurn: [120, 135, 150, 165, 180],
};

export interface Candidate {
  thresholds: Thresholds;
  evaluation: Evaluation;
  /** How far from the current values, summed in relative terms; smaller is a gentler change. */
  change: number;
}

function shortfall(e: Evaluation): number {
  return (
    Math.max(0, ACCEPTANCE.circleRate - (Number.isNaN(e.circleRate) ? 1 : e.circleRate)) +
    Math.max(0, (Number.isNaN(e.fishAsCircle) ? 0 : e.fishAsCircle) - ACCEPTANCE.fishAsCircle) +
    e.spiralOrUAsCircle
  );
}

/**
 * Every combination in SWEEP, best first: meeting the acceptance first, then
 * the most strokes read correctly, then the smallest change from `base`.
 */
export function sweep(measured: Measured[], base: Thresholds = THRESHOLDS, top = 5): Candidate[] {
  const keys = Object.keys(SWEEP) as (keyof Thresholds)[];
  const out: Candidate[] = [];
  const walk = (i: number, T: Thresholds) => {
    if (i === keys.length) {
      const evaluation = evaluate(measured, T);
      const change = keys.reduce((s, k) => s + Math.abs(T[k] - base[k]) / base[k], 0);
      out.push({ thresholds: { ...T }, evaluation, change });
      return;
    }
    for (const v of SWEEP[keys[i]]!) walk(i + 1, { ...T, [keys[i]]: v });
  };
  walk(0, { ...base });
  out.sort(
    (a, b) =>
      shortfall(a.evaluation) - shortfall(b.evaluation) ||
      b.evaluation.correct - a.evaluation.correct ||
      a.change - b.change,
  );
  return out.slice(0, top);
}

/** The everyday fish stroke, for reading 笔性 (koi-style.ts). */
export const STYLE_CATEGORIES = ['line'];

export interface StyleSplit {
  pointerType: string;
  n: number;
  /** Speed quartiles, short screen edges per second. */
  speed: [number, number, number];
  curviness: number;
  /** STYLE.fastSplit now, and the median as a suggestion: half fast, half slow. */
  current: number;
  suggested: number;
  /** How the strokes fall into families with the current splits. */
  families: Record<Family, number>;
  /** Speeds far outside the rest (beyond 3 × the interquartile range): look at these strokes before trusting a split. */
  outliers: number[];
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

/** Per pointer type: how fast people draw, and where fast and slow would split evenly. */
export function styleSplits(samples: Sample[]): StyleSplit[] {
  const by = new Map<string, { speed: number; curviness: number }[]>();
  for (const s of samples) {
    if (!STYLE_CATEGORIES.includes(s.category) || s.points.length < 2) continue;
    const pts = s.points.map(([x, y, t]) => ({ x, y, t }));
    const st = strokeStyle(pts, Math.min(s.width, s.height), s.pointerType);
    if (!by.has(s.pointerType)) by.set(s.pointerType, []);
    by.get(s.pointerType)!.push(st);
  }
  return [...by.entries()].map(([pointerType, list]) => {
    const speeds = list.map((x) => x.speed).sort((a, b) => a - b);
    const curv = list.map((x) => x.curviness).sort((a, b) => a - b);
    const families: Record<Family, number> = { brisk: 0, lively: 0, calm: 0, round: 0 };
    for (const x of list) families[familyOf(x.speed, x.curviness, pointerType)]++;
    const [q1, , q3] = [quantile(speeds, 0.25), 0, quantile(speeds, 0.75)];
    const iqr = q3 - q1;
    return {
      pointerType,
      n: list.length,
      outliers: speeds.filter((v) => v < q1 - 3 * iqr || v > q3 + 3 * iqr),
      speed: [quantile(speeds, 0.25), quantile(speeds, 0.5), quantile(speeds, 0.75)],
      curviness: quantile(curv, 0.5),
      current: STYLE.fastSplit[pointerType] ?? STYLE.fastSplit.mouse,
      suggested: quantile(speeds, 0.5),
      families,
    };
  });
}
