import { describe, expect, it } from 'vitest';
import { evaluate, judge, measure, report, type LoggedEvent } from './sessions';

const log = (events: LoggedEvent[], device = 'desktop') => ({ device, events });

describe('measure', () => {
  const events: LoggedEvent[] = [
    { t: 1000, type: 'world_ready', device: 'desktop' },
    { t: 4000, type: 'first_stroke', after: 3000 },
    { t: 4100, type: 'create', what: 'fish', prompted: false },
    { t: 9000, type: 'hint_shown', hint: 'touch_fish' },
    { t: 60000, type: 'phase_change', phase: 'free' },
    { t: 61000, type: 'create', what: 'fish', prompted: false },
    { t: 70000, type: 'hint_shown', hint: 'draw_circle' },
    { t: 75000, type: 'create', what: 'moon', prompted: false }, // within 10 s of a hint
    { t: 90000, type: 'text_submit', source: 'ai', prompted: false },
    { t: 95000, type: 'create', what: 'star', prompted: false },
    { t: 99000, type: 'record_complete', seconds: 15 },
    { t: 101000, type: 'save', how: 'downloaded' },
    { t: 120000, type: 'undo', kind: 'fish' },
  ];

  it('counts unprompted creations in the free segment only', () => {
    const m = measure(log(events), { tester: 'P01', askedForHelp: false });
    expect(m.freeCreations).toBe(4);
    expect(m.unpromptedFreeCreations).toBe(3);
    expect(m.h2).toBe(true);
  });

  it('passes H1 on a quick first stroke without help, and H3 on a save', () => {
    const m = measure(log(events), { tester: 'P01', askedForHelp: false });
    expect(m.h1).toBe(true);
    expect(m.h3).toBe(true);
    expect(m.aiAnswered).toBe(1);
    expect(m.lastActionBeforeStop).toBe('undo');
  });

  it('leaves what only the observer knows as unknown, but a slow first stroke still fails H1', () => {
    expect(measure(log(events), { tester: 'P02' }).h1).toBeNull();
    const slow = events.map((e) => (e.type === 'first_stroke' ? { ...e, after: 8000 } : e));
    expect(measure(log(slow), { tester: 'P03' }).h1).toBe(false);
  });

  it('has no H2 reading without a free segment', () => {
    const guidedOnly = events.filter((e) => e.type !== 'phase_change');
    expect(measure(log(guidedOnly), { tester: 'P04', askedForHelp: false }).h2).toBeNull();
  });
});

describe('judge', () => {
  it('is uncertain with fewer than five testers', () => {
    expect(judge('H1', [true, true, true, true], 0.8).verdict).toBe('不确定');
  });

  it('is clear only when one tester either way would not change it', () => {
    expect(judge('H1', Array(10).fill(true), 0.8).verdict).toBe('成立'); // 10/10
    expect(judge('H1', [...Array(8).fill(true), false, false], 0.8).verdict).toBe('不确定'); // 8/10, 7 would fail
    expect(judge('H3', [true, ...Array(9).fill(false)], 0.3).verdict).toBe('不成立'); // 1/10, 2 still short
    expect(judge('H3', [true, true, ...Array(8).fill(false)], 0.3).verdict).toBe('不确定');
  });

  it('is uncertain while observer notes are missing', () => {
    expect(judge('H1', [true, true, true, true, true, null], 0.8).verdict).toBe('不确定');
  });
});

describe('report', () => {
  it('renders a table per hypothesis and per tester', () => {
    const m = measure(log([{ t: 0, type: 'first_stroke', after: 2000 }]), { tester: 'P01', askedForHelp: false });
    const md = report([m], evaluate([m]));
    expect(md).toContain('| H1 | 1/1');
    expect(md).toContain('| P01 | desktop | 2.0 |');
  });
});
