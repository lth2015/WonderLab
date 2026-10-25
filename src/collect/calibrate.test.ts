import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../engine/classify';
import { evaluate, measureAll, styleSplits, sweep } from './calibrate';
import { isSession, REPS, CATEGORIES } from './protocol';
import { seededRandom, syntheticSession, syntheticStudy } from './synth';

describe('synthetic strokes', () => {
  it('are seeded: the same seed draws the same session', () => {
    expect(syntheticSession(7, 'phone')).toEqual(syntheticSession(7, 'phone'));
    expect(syntheticSession(7, 'phone')).not.toEqual(syntheticSession(8, 'phone'));
    const r = seededRandom(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('look like a ?collect export', () => {
    const s = syntheticSession(3, 'desktop');
    expect(isSession(s)).toBe(true);
    expect(s.samples).toHaveLength(CATEGORIES.length * REPS);
  });
});

describe('calibration', () => {
  const study = syntheticStudy();
  const measured = measureAll(study.flatMap((s) => s.samples));

  it('the current thresholds meet the docs/02 §5.2 acceptance on the synthetic study', () => {
    const e = evaluate(measured, THRESHOLDS);
    expect(e.total).toBe(study.length * CATEGORIES.length * REPS);
    expect(e.circleRate).toBeGreaterThanOrEqual(0.9);
    expect(e.fishAsCircle).toBeLessThanOrEqual(0.1);
    expect(e.spiralOrUAsCircle).toBe(0);
    expect(e.meetsAcceptance).toBe(true);
    expect(e.correct / e.total).toBeGreaterThan(0.95);
    expect(e.misses).toHaveLength(e.total - e.correct);
  });

  it('fails the acceptance when the thresholds are clearly wrong', () => {
    const e = evaluate(measured, { ...THRESHOLDS, maxResidual: 0.02 });
    expect(e.meetsAcceptance).toBe(false);
  });

  it('without any circles or fish, the rates are NaN and do not fail the acceptance', () => {
    const e = evaluate(measured.filter((m) => m.sample.category === 'tap'));
    expect(e.circleRate).toBeNaN();
    expect(e.fishAsCircle).toBeNaN();
    expect(e.meetsAcceptance).toBe(true);
  });

  it('the sweep ranks candidates, best first', () => {
    const top = sweep(measured, THRESHOLDS, 3);
    expect(top).toHaveLength(3);
    expect(top[0].evaluation.meetsAcceptance).toBe(true);
    expect(top[0].evaluation.correct).toBeGreaterThanOrEqual(top[1].evaluation.correct);
  });

  it('reads where fast and slow strokes divide, per pointer type', () => {
    const splits = styleSplits(study.flatMap((s) => s.samples));
    expect(splits.map((x) => x.pointerType).sort()).toEqual(['mouse', 'touch']);
    for (const x of splits) {
      expect(x.n).toBe((study.length / 2) * REPS);
      expect(x.speed[0]).toBeLessThanOrEqual(x.speed[1]);
      expect(x.speed[1]).toBeLessThanOrEqual(x.speed[2]);
      expect(Object.values(x.families).reduce((a, b) => a + b, 0)).toBe(x.n);
    }
  });
});
