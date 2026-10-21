import { describe, expect, it } from 'vitest';
import { isSession, summarize, type Sample } from './protocol';

// Real strokes exported from ?collect and committed under strokes/.
// Acceptance from docs/02 §5.2: hand-drawn circles ≥ 90%, fish outlines
// taken for circles ≤ 10%. With no files yet, the suite is skipped.
const files = import.meta.glob('../../strokes/*.json', { eager: true, import: 'default' });
const samples: Sample[] = Object.values(files).flatMap((v) => (isSession(v) ? v.samples : []));

const rate = (ids: string[], kinds: string[]) => {
  const mine = samples.filter((s) => ids.includes(s.category));
  const stats = summarize(mine);
  let hit = 0;
  for (const st of stats) for (const k of kinds) hit += st.outcomes[k as keyof typeof st.outcomes] ?? 0;
  return { n: mine.length, rate: mine.length ? hit / mine.length : NaN };
};

describe.skipIf(samples.length === 0)(`classify on collected strokes (${samples.length})`, () => {
  it('prints the per-shape table', () => {
    const rows = summarize(samples).map((s) => ({
      shape: s.category.label,
      correct: `${s.correct}/${s.total}`,
      outcomes: JSON.stringify(s.outcomes),
    }));
    console.table(rows);
  });

  it('recognises hand-drawn and lopsided circles ≥ 90% of the time', () => {
    const { n, rate: r } = rate(['circle', 'wonky'], ['circle']);
    if (n) expect(r).toBeGreaterThanOrEqual(0.9);
  });

  it('takes fish outlines for circles ≤ 10% of the time', () => {
    const { n, rate: r } = rate(['fish'], ['circle']);
    if (n) expect(r).toBeLessThanOrEqual(0.1);
  });

  it('never takes spirals or U shapes for circles', () => {
    expect(rate(['spiral', 'u'], ['circle']).rate || 0).toBe(0);
  });
});
