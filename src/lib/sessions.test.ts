import { describe, expect, it } from 'vitest';
import { afterFirstFish, afterGift, analyzeStudy, buildOf, buildsOf, needed, analyzeTester, formatReport, freeSpans, isSessionLog, judge, type SessionEvent, type SessionLog } from './sessions';

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

  it('does not infer spontaneity from old booleans, completed recordings or saves', () => {
    for (const notes of [{}, { askedToSend: true }, { askedToSend: false }]) {
      expect(analyzeTester('a', log(base), notes).h3).toBeNull();
      expect(analyzeTester('a', log([...base, ev(95000, 'save', { how: 'downloaded' })]), notes).h3).toBeNull();
    }
    expect(analyzeTester('a', log([...base, ev(95000, 'save', { how: 'shared' })])).h3).toBeNull();
  });

  it('counts documented spontaneous saving or an unsolicited request as H3 success', () => {
    for (const evidence of ['引导段02:00，未被提示，自行保存', '自由段结束、访谈提问前主动问怎么发给朋友，之前无提示']) {
      expect(analyzeTester('a', log(base), {
        askedToSend: false, // New provenance overrides the ambiguous legacy field.
        h3Observation: { status: 'spontaneous', evidence },
      }).h3).toBe(true);
    }
  });

  it('does not count prompted-only intent, even with a successful save or old true', () => {
    expect(analyzeTester('a', log([...base, ev(95000, 'save', { how: 'downloaded' })]), {
      askedToSend: true,
      h3Observation: { status: 'prompted_only', windowComplete: true, evidence: '完整窗口，仅主持人问要不要保存后保存；之前无主动行为' },
    }).h3).toBe(false);
    expect(analyzeTester('a', log(base), {
      h3Observation: { status: 'not_observed', windowComplete: true, evidence: '完整窗口核对，无请求，无保存，无提示' },
    }).h3).toBe(false);
  });

  it('leaves absent, incomplete, unknown or malformed observations unknown', () => {
    for (const h3Observation of [
      { status: 'spontaneous' },
      { status: 'prompted_only', windowComplete: true, evidence: '  ' },
      { status: 'not_observed' },
      { status: 'unknown', evidence: '无法判断先后' },
      { status: 'typo', evidence: '无法判断' },
      { status: 'spontaneous', evidence: true },
      null,
    ]) {
      // JSON is runtime input; malformed evidence must never manufacture success.
      const notes = { h3Observation } as unknown as import('./sessions').ObserverNotes;
      expect(analyzeTester('a', log(base), notes).h3).toBeNull();
    }
  });

  it('requires explicit complete coverage to score a negative', () => {
    for (const status of ['prompted_only', 'not_observed'] as const) {
      for (const windowComplete of [undefined, false]) {
        expect(analyzeTester('a', log(base), {
          h3Observation: { status, evidence: '有文字但覆盖范围不完整', windowComplete },
        }).h3).toBeNull();
      }
    }
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
    // Small study, no free phase, H3 unknown — and a log that records no build.
    expect(r.warnings).toHaveLength(4);
    expect(r.warnings.some((w) => w.includes('不是冻结的实验构建') && w.includes('s1.json'))).toBe(true);
    expect(r.h1.verdict).toBe('成立');
    const md = formatReport(r);
    expect(md).toContain('| H1 |');
    expect(md).toContain('s1.json');
  });

  it('keeps H3 unknowns in the denominator and retains the 30% threshold', () => {
    const make = (status: 'spontaneous' | 'not_observed' | 'unknown') => ({
      id: status, log: log([]), notes: { h3Observation: { status, windowComplete: true, evidence: '测试证据' } },
    });
    const r = analyzeStudy([make('spontaneous'), make('not_observed'), ...Array.from({ length: 8 }, () => make('unknown'))]);
    expect(r.h3).toEqual({ met: 1, unknown: 8, total: 10, threshold: 0.3, verdict: '不确定' });
    expect(analyzeStudy([...Array.from({ length: 3 }, () => make('spontaneous')), ...Array.from({ length: 7 }, () => make('unknown'))]).h3.verdict).toBe('成立');
    expect(analyzeStudy([...Array.from({ length: 2 }, () => make('spontaneous')), ...Array.from({ length: 8 }, () => make('not_observed'))]).h3.verdict).toBe('不成立');
    expect(formatReport(r)).toContain('保存（含被提示）');
    expect(formatReport(r)).toContain('未知 8');
  });

  it('recognises an exported log', () => {
    expect(isSessionLog({ exportedAt: 'x', events: [{ t: 1, type: 'world_ready' }] })).toBe(true);
    expect(isSessionLog({ events: [{ type: 'x' }] })).toBe(false);
    expect(isSessionLog([])).toBe(false);
  });
});

describe('afterFirstFish (创造的乐趣 / 陪伴的乐趣)', () => {
  it('reads creating again at once', () => {
    expect(afterFirstFish([ev(1000, 'create', { what: 'fish' }), ev(4000, 'create', { what: 'fish' })])).toEqual({ kind: 'create', gapMs: 3000, touched: false });
  });
  it('reads stopping to watch: a long pause, or touching the fish first', () => {
    expect(afterFirstFish([ev(1000, 'create', { what: 'fish' }), ev(15000, 'text_submit')])!.kind).toBe('watch');
    expect(afterFirstFish([ev(1000, 'create', { what: 'fish' }), ev(2000, 'touch', { object: 'fish' }), ev(3000, 'create', { what: 'moon' })])).toEqual({
      kind: 'watch',
      gapMs: 2000,
      touched: true,
    });
  });
  it('reads never creating again, and no fish at all', () => {
    expect(afterFirstFish([ev(1000, 'create', { what: 'fish' }), ev(5000, 'touch', { object: 'lake' })])).toEqual({ kind: 'none', gapMs: null, touched: false });
    expect(afterFirstFish([ev(1000, 'create', { what: 'moon' })])).toBeNull();
  });
});

describe('afterGift (送一条鱼)', () => {
  it('reads whether a person who took in a fish then drew their own', () => {
    expect(afterGift([ev(0, 'gift_shown'), ev(2000, 'gift_accepted'), ev(9000, 'create', { what: 'fish' })])).toEqual({ createdOwnFish: true, afterMs: 7000 });
    expect(afterGift([ev(2000, 'gift_accepted'), ev(5000, 'touch', { object: 'fish' })])).toEqual({ createdOwnFish: false, afterMs: null });
    expect(afterGift([ev(0, 'gift_shown')])).toBeNull();
  });
});

describe('builds and invalid samples (docs/验证路线图.md)', () => {
  const ready = (sha: string, experiment: string) => ev(0, 'world_ready', { device: 'phone', buildSha: sha, experimentId: experiment, schemaVersion: 2 });
  const freeRun = (t0: number) => [ev(t0 + 100, 'phase_change', { phase: 'free' }), ev(t0 + 200, 'create', { what: 'fish' })];

  it('reads the build from the export, or from world_ready', () => {
    expect(buildOf({ build: { sha: 'abc', experiment: 'poc-r1', schema: 2 }, events: [] })).toEqual({ sha: 'abc', experiment: 'poc-r1' });
    expect(buildOf(log([ready('def', 'poc-gift-r1')]))).toEqual({ sha: 'def', experiment: 'poc-gift-r1' });
    expect(buildOf(log([ev(0, 'world_ready')]))).toBeNull();
  });

  it("in a field tester's export, each record's own build wins over the exporting build", () => {
    const fieldExport = {
      exportedBy: { sha: 'bbb222', experiment: 'poc-r1', schema: 2 },
      events: [ev(100, 'create', { what: 'fish', sha: 'aaa111', exp: 'poc-r1' }), ev(200, 'create', { what: 'moon', sha: 'bbb222', exp: 'poc-r1' })],
      visits: [{ at: 90, ms: 1, creations: 1, sha: 'aaa111', exp: 'poc-r1' }],
    };
    expect(buildsOf(fieldExport)).toEqual([
      { sha: 'aaa111', experiment: 'poc-r1' },
      { sha: 'bbb222', experiment: 'poc-r1' },
    ]);
    expect(buildOf(fieldExport)).toBeNull();
    const one = { events: [ev(100, 'create', { what: 'fish', sha: 'aaa111', exp: 'poc-r1' })] };
    expect(buildOf(one)).toEqual({ sha: 'aaa111', experiment: 'poc-r1' });
  });

  it('flags a log that mixes builds, and one with records from before build stamping', () => {
    const mixed = log([ev(0, 'phase_change', { phase: 'free', sha: 'aaa111', exp: 'poc-r1' }), ev(200, 'create', { what: 'fish', sha: 'bbb222', exp: 'poc-r1' })]);
    const old = log([ev(0, 'phase_change', { phase: 'free', sha: 'unknown', exp: 'unknown' }), ev(200, 'create', { what: 'fish', sha: 'unknown', exp: 'unknown' })]);
    const r = analyzeStudy([
      { id: 'C1', log: mixed },
      { id: 'C2', log: old },
    ]);
    expect(r.warnings.some((w) => w.includes('同一份记录里混有多个构建') && w.includes('C1（poc-r1@aaa111、poc-r1@bbb222）'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('不是冻结的实验构建') && w.includes('C2'))).toBe(true);
    expect(formatReport(r)).toContain('poc-r1@aaa111 + poc-r1@bbb222');
  });

  it('the thresholds in whole testers: 7, 5 and 3 of 8', () => {
    expect(needed({ threshold: 0.8, total: 8 })).toBe(7);
    expect(needed({ threshold: 0.6, total: 8 })).toBe(5);
    expect(needed({ threshold: 0.3, total: 8 })).toBe(3);
  });

  it('warns when builds are mixed or not frozen, and keeps invalid sessions out of the count', () => {
    const r = analyzeStudy([
      { id: 'P1', log: log([ready('aaa', 'poc-r1'), ...freeRun(0)]) },
      { id: 'P2', log: log([ready('bbb', 'poc-r1'), ...freeRun(0)]) },
      { id: 'P3', log: log([ready('aaa-dirty', 'dev'), ...freeRun(0)]), notes: { invalid: '中途离开' } },
    ]);
    expect(r.h2.total).toBe(2);
    expect(r.testers).toHaveLength(3);
    expect(r.warnings.some((w) => w.includes('无效样本') && w.includes('P3（中途离开）'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('不同的构建'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('不是冻结的实验构建'))).toBe(false);
    const report = formatReport(r);
    expect(report).toContain('P3（无效）');
    expect(report).toContain('2 人中需');
  });
});
