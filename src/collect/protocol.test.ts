import { describe, expect, it } from 'vitest';
import { CATEGORIES, plan, read, REPS, summarize, type Sample } from './protocol';

const sample = (category: string, points: [number, number, number][]): Sample => ({
  category,
  rep: 0,
  points,
  width: 800,
  height: 600,
  pointerType: 'mouse',
});

describe('collection protocol', () => {
  it('plans every category REPS times', () => {
    const p = plan(() => 0.3);
    expect(p).toHaveLength(CATEGORIES.length * REPS);
    for (const c of CATEGORIES) expect(p.filter((x) => x.category === c.id)).toHaveLength(REPS);
  });

  it('reads taps and long presses by movement and hold time', () => {
    expect(read(sample('tap', [[100, 100, 0], [103, 101, 120]])).outcome).toBe('tap');
    expect(read(sample('tap', [[100, 100, 0], [102, 100, 700]])).outcome).toBe('press');
  });

  it('reads a drawn circle as a circle and scores it', () => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      pts.push([400 + Math.cos(a) * 100, 300 + Math.sin(a) * 100, i * 10]);
    }
    const s = sample('circle', pts);
    expect(read(s).outcome).toBe('circle');
    const stats = summarize([s]).find((x) => x.category.id === 'circle')!;
    expect(stats).toMatchObject({ total: 1, correct: 1 });
  });
});
