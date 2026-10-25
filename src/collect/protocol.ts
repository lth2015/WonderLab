// The stroke test set from docs/02-product-design.md §4: ten shapes, each
// drawn five times per tester. Real strokes collected here replace the
// synthetic ones in classify.test.ts when tuning the docs/03 §6.2 thresholds.
import { classify, type MoonPhase, type StrokeKind } from '../engine/classify';

// Mirrors engine.ts (docs/03 §6.2).
export const TAP_MOVE = 8;
export const LONG_PRESS_MS = 500;
export const REPS = 5;

export type Outcome = StrokeKind | 'tap' | 'press';

export interface Category {
  id: string;
  label: string;
  hint: string;
  /** Outcomes that count as a correct reading. */
  accept: Outcome[];
}

export const CATEGORIES: Category[] = [
  // The everyday fish stroke: how fast and how curved people draw it sets 笔性 (koi-style.ts).
  { id: 'line', label: '画鱼的一笔', hint: '在湖面上画一条鱼：随手一笔弯线', accept: ['open', 'arc'] },
  { id: 'circle', label: '随手圆', hint: '像平时一样随手画一个圆', accept: ['circle'] },
  { id: 'wonky', label: '歪圆', hint: '画一个不太圆、有点扁的圆', accept: ['circle'] },
  { id: 'half', label: '半圆', hint: '画半个圆，不要闭合', accept: ['arc'] },
  { id: 'fish', label: '鱼形轮廓', hint: '一笔画出一条鱼的外形', accept: ['elongated'] },
  { id: 's', label: 'S 形', hint: '画一个 S', accept: ['open'] },
  { id: 'spiral', label: '螺旋', hint: '从中心向外画一圈圈螺旋', accept: ['open', 'elongated', 'arc'] },
  { id: 'u', label: 'U 形', hint: '画一个 U', accept: ['open', 'arc'] },
  { id: 'dash', label: '短划', hint: '轻轻划一小笔', accept: ['short'] },
  { id: 'tap', label: '点按', hint: '在画面上点一下', accept: ['tap'] },
];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  tap: '点按',
  press: '长按',
  short: '短笔',
  circle: '圆',
  elongated: '细长闭合',
  arc: '弧',
  open: '开放曲线',
};

/** One stroke as drawn: screen pixels (y down) and ms since pen-down. */
export interface Sample {
  category: string;
  rep: number;
  points: [x: number, y: number, t: number][];
  width: number;
  height: number;
  pointerType: string;
}

export interface Session {
  version: 1;
  tester: string;
  device: string;
  startedAt: string;
  samples: Sample[];
}

export interface Reading {
  outcome: Outcome;
  phase?: MoonPhase;
}

export function read(sample: Sample): Reading {
  const pts = sample.points;
  const [x0, y0] = pts[0];
  let moved = 0;
  for (const [x, y] of pts) moved = Math.max(moved, Math.hypot(x - x0, y - y0));
  if (moved < TAP_MOVE) {
    const held = pts[pts.length - 1][2];
    return { outcome: held >= LONG_PRESS_MS ? 'press' : 'tap' };
  }
  const c = classify(
    pts.map(([x, y]) => ({ x, y })),
    Math.min(sample.width, sample.height),
  );
  return { outcome: c.kind, phase: c.phase };
}

export function isCorrect(sample: Sample, reading = read(sample)): boolean {
  const cat = CATEGORIES.find((c) => c.id === sample.category);
  return !!cat && cat.accept.includes(reading.outcome);
}

export interface CategoryStats {
  category: Category;
  total: number;
  correct: number;
  outcomes: Partial<Record<Outcome, number>>;
}

export function summarize(samples: Sample[]): CategoryStats[] {
  return CATEGORIES.map((category) => {
    const mine = samples.filter((s) => s.category === category.id);
    const outcomes: Partial<Record<Outcome, number>> = {};
    let correct = 0;
    for (const s of mine) {
      const r = read(s);
      outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
      if (category.accept.includes(r.outcome)) correct++;
    }
    return { category, total: mine.length, correct, outcomes };
  });
}

/** Every category REPS times, shuffled so fatigue and practice spread evenly. */
export function plan(random = Math.random): { category: string; rep: number }[] {
  const items = CATEGORIES.flatMap((c) => Array.from({ length: REPS }, (_, rep) => ({ category: c.id, rep })));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function isSession(v: unknown): v is Session {
  const s = v as Session;
  return !!s && s.version === 1 && Array.isArray(s.samples) && s.samples.every((x) => Array.isArray(x.points) && x.points.length > 0);
}
