import { describe, expect, it } from 'vitest';
import { analyzeStudy, analyzeTester, formatReport, freeSpans, isSessionLog, judge, type SessionEvent, type SessionLog } from './sessions';

const log = (events: SessionEvent[]): SessionLog => ({ device: 'desktop', events });
const ev = (t: number, type: string, fields: Record<string, string | number | boolean> = {}): SessionEvent => ({ t, type, ...fields });

describe('freeSpans', () => {
  it('pairs free with the next guided, and runs an open free phase to the last event', () => {
    const events = [ev(0, 'world_ready'), ev(100, 'phase_change', { phase: 'free' }), ev(500, 'phase_change', { phase: 'guided' }), ev(800, 'phase_change', { phase: 'free' }), ev(2000, 'create')];
    expect(freeSpans(events)).toEqual([[100, 500], [800, 2001]]);
  });
});

describe('analyzeTester', () => {
  const base = [
    ev(0, 'world_ready', { device: 'phone' }),
    ev(3200, 'first_stroke', { after: 3200 }),
    ev(4000, 'create', { what: 'fish', prompted: false }), // guided: not counted for H2
    ev(60000, 'phase_change', { phase: 'free' }),
    ev(61000, 'create', { what: 'fish', prompted: true }),
    ev(62000, 'create', { what: 'moon', prompted: false }),
    ev(63000, 'text_submit', { source: 'local', prompted: false }),
    ev(64000, 'undo', { kind: 'moon', after: 1500 }),
    ev(65000, 'create', { what: 'star', prompted: false }),
    ev(70000, 'record_start'),
    ev(85000, 'record_complete', { seconds: 15 }),
    ev(90000, 'save', { how: 'cancelled', format: 'mp4' }),
  ];

  it('counts unprompted creations in the free phase only, sentences included', () => {
    const t = analyzeTester('a', log(base));
    expect(t.device).toBe('phone');
    expect(t.unpromptedInFree).toBe(3);
    expect(t.promptedInFree).toBe(1);
    expect(t.h2).toBe(true);
    expect(t.quickUndos).toEqual({ moon: 1 });
    expect(t.recordsCompleted).toBe(1);
  });

  it('needs the notes to say yes to H1, but not to say no', () => {
    expect(analyzeTester('a', log(base)).h1).toBeNull();
    expect(analyzeTester('a', log(base), { helpBeforeFirstStroke: false }).h1).toBe(true);
    expect(analyzeTester('a', log(base), { helpBeforeFirstStroke: true }).h1).toBe(false);
    const slow = base.map((e) => (e.type === 'first_stroke' ? { ...e, after: 7000 } : e));
    expect(analyzeTester('a', log(slow)).h1).toBe(false);
    expect(analyzeTester('a', log(base.filter((e) => e.type !== 'first_stroke'))).h1).toBe(false);
  });

  it('a cancelled save is not a save; asking how to send counts', () => {
    expect(analyzeTester('a', log(base)).h3).toBeNull();
    expect(analyzeTester('a', log(base), { askedToSend: true }).h3).toBe(true);
    expect(analyzeTester('a', log(base), { askedToSend: false }).h3).toBe(false);
    expect(analyzeTester('a', log([...base, ev(95000, 'save', { how: 'downloaded', format: 'mp4' })])).h3).toBe(true);
  });

  it('a log without a free phase leaves H2 unknown', () => {
    const t = analyzeTester('a', log(base.filter((e) => e.type !== 'phase_change')));
    expect(t.freeMinutes).toBeNull();
    expect(t.h2).toBeNull();
  });
});

describe('judge', () => {
  it('decides only when the unknowns cannot tip it', () => {
    expect(judge([true, true, true, true, false], 0.8).verdict).toBe('成立');
    expect(judge([true, true, true, false, false], 0.8).verdict).toBe('不成立');
    expect(judge([true, true, true, null, false], 0.8).verdict).toBe('不确定');
    expect(judge([true, null, false, false, false], 0.6).verdict).toBe('不成立');
    expect(judge([], 0.3).verdict).toBe('不确定');
  });
});

describe('analyzeStudy', () => {
  it('warns about a small study and logs without a free phase, and formats a report', () => {
    const r = analyzeStudy([{ id: 's1.json', log: log([ev(0, 'world_ready'), ev(2000, 'first_stroke', { after: 2000 })]), notes: { helpBeforeFirstStroke: false } }]);
    expect(r.warnings).toHaveLength(2);
    expect(r.h1.verdict).toBe('成立');
    const md = formatReport(r);
    expect(md).toContain('| H1 |');
    expect(md).toContain('s1.json');
  });

  it('recognises an exported log', () => {
    expect(isSessionLog({ exportedAt: 'x', events: [{ t: 1, type: 'world_ready' }] })).toBe(true);
    expect(isSessionLog({ events: [{ type: 'x' }] })).toBe(false);
    expect(isSessionLog([])).toBe(false);
  });
});
