// Stage D analysis (docs/02 §1, §8): turn exported event logs plus the
// observer's notes into the H1–H3 measures and a verdict for each, against
// the thresholds agreed in advance. Pure functions, so they are tested in
// sessions.test.ts and run by scripts/analyze-sessions.mjs.

export interface LoggedEvent {
  t: number;
  type: string;
  [field: string]: string | number | boolean;
}

export interface SessionLog {
  exportedAt?: string;
  device?: string;
  events: LoggedEvent[];
}

/** What only the observer can see (docs/05 §4). Missing fields stay unknown. */
export interface ObserverNotes {
  tester: string;
  /** Asked for help, or looked to the observer, before the first stroke. */
  askedForHelp?: boolean;
  /** Asked how to send or keep the work, without being prompted. */
  askedToSend?: boolean;
}

export const THRESHOLDS = {
  firstStrokeMs: 5000,
  promptWindowMs: 10000,
  h1Share: 0.8,
  h2Creations: 3,
  h2Share: 0.6,
  h3Share: 0.3,
  minTesters: 5,
};

export interface TesterMeasures {
  tester: string;
  device: string;
  firstStrokeMs: number | null;
  askedForHelp: boolean | null;
  /** H1: first stroke within 5 s and no help asked. null when notes are missing. */
  h1: boolean | null;
  freeMinutes: number | null;
  creations: number;
  freeCreations: number;
  unpromptedFreeCreations: number;
  h2: boolean | null;
  recordings: number;
  saves: number;
  askedToSend: boolean | null;
  h3: boolean | null;
  textSubmits: number;
  aiAnswered: number;
  undos: number;
  lastActionBeforeStop: string | null;
}

const CREATIONS = new Set(['create', 'text_submit']);

export function measure(log: SessionLog, notes: ObserverNotes): TesterMeasures {
  const ev = [...log.events].sort((a, b) => a.t - b.t);
  const T = THRESHOLDS;

  const first = ev.find((e) => e.type === 'first_stroke');
  const firstStrokeMs = first && typeof first.after === 'number' ? first.after : null;
  const askedForHelp = notes.askedForHelp ?? null;
  const quick = firstStrokeMs !== null && firstStrokeMs <= T.firstStrokeMs;
  const h1 = !quick ? false : askedForHelp === null ? null : !askedForHelp;

  // The free segment starts at the last switch into it (docs/02 §8).
  const freeStart = [...ev].reverse().find((e) => e.type === 'phase_change' && e.phase === 'free')?.t ?? null;
  const hints = ev.filter((e) => e.type === 'hint_shown').map((e) => e.t);
  // docs/02 §1: unprompted = not within 10 s after any hint. Recomputed from
  // the raw hint times rather than trusting the in-app flag alone.
  const unprompted = (e: LoggedEvent) => e.prompted !== true && !hints.some((h) => e.t >= h && e.t - h <= T.promptWindowMs);
  const creations = ev.filter((e) => CREATIONS.has(e.type));
  const free = freeStart === null ? [] : creations.filter((e) => e.t >= freeStart);
  const unpromptedFree = free.filter(unprompted).length;
  const h2 = freeStart === null ? null : unpromptedFree >= T.h2Creations;

  const last = ev[ev.length - 1];
  const freeMinutes = freeStart === null || !last ? null : Math.round(((last.t - freeStart) / 60000) * 10) / 10;
  const meaningful = [...ev].reverse().find((e) => !['tier_change', 'hint_shown', 'phase_change'].includes(e.type));

  const recordings = ev.filter((e) => e.type === 'record_complete').length;
  const saves = ev.filter((e) => e.type === 'save' && e.how !== 'cancelled').length;
  const askedToSend = notes.askedToSend ?? null;
  const h3 = saves > 0 || askedToSend === true ? true : askedToSend === null ? null : false;

  const texts = ev.filter((e) => e.type === 'text_submit');
  return {
    tester: notes.tester,
    device: log.device ?? String(ev.find((e) => e.type === 'world_ready')?.device ?? 'unknown'),
    firstStrokeMs,
    askedForHelp,
    h1,
    freeMinutes,
    creations: creations.length,
    freeCreations: free.length,
    unpromptedFreeCreations: unpromptedFree,
    h2,
    recordings,
    saves,
    askedToSend,
    h3,
    textSubmits: texts.length,
    aiAnswered: texts.filter((e) => e.source === 'ai').length,
    undos: ev.filter((e) => e.type === 'undo').length,
    lastActionBeforeStop: meaningful ? String(meaningful.what ?? meaningful.type) : null,
  };
}

export type Verdict = '成立' | '不成立' | '不确定';

export interface HypothesisResult {
  id: 'H1' | 'H2' | 'H3';
  passed: number;
  known: number;
  total: number;
  share: number | null;
  threshold: number;
  verdict: Verdict;
  why: string;
}

/**
 * 成立 / 不成立 when the result is clear of the threshold by more than one
 * tester either way; 不确定 when it is within one tester, when fewer than five
 * testers have data, or when observer notes are missing for some of them.
 */
export function judge(id: HypothesisResult['id'], values: (boolean | null)[], threshold: number): HypothesisResult {
  const total = values.length;
  const known = values.filter((v) => v !== null).length;
  const passed = values.filter((v) => v === true).length;
  const share = known ? passed / known : null;
  const base = { id, passed, known, total, share, threshold };
  if (known < THRESHOLDS.minTesters) return { ...base, verdict: '不确定', why: `有数据的测试者只有 ${known} 人，少于 ${THRESHOLDS.minTesters} 人` };
  if (known < total) return { ...base, verdict: '不确定', why: `${total - known} 人缺观察记录` };
  const need = threshold * known;
  if (passed - 1 >= need) return { ...base, verdict: '成立', why: `${passed}/${known} 达到阈值，少一人仍达标` };
  if (passed + 1 < need) return { ...base, verdict: '不成立', why: `${passed}/${known} 未达阈值，多一人仍不达标` };
  return { ...base, verdict: '不确定', why: `${passed}/${known} 离阈值只差一人以内` };
}

export function evaluate(testers: TesterMeasures[]): HypothesisResult[] {
  const T = THRESHOLDS;
  return [
    judge('H1', testers.map((t) => t.h1), T.h1Share),
    judge('H2', testers.map((t) => t.h2), T.h2Share),
    judge('H3', testers.map((t) => t.h3), T.h3Share),
  ];
}

const yn = (v: boolean | null) => (v === null ? '?' : v ? '是' : '否');

export function report(testers: TesterMeasures[], results: HypothesisResult[]): string {
  const lines = [
    '# 阶段 D 数据汇总',
    '',
    `测试者 ${testers.length} 人（手机 ${testers.filter((t) => t.device === 'phone').length}，桌面 ${testers.filter((t) => t.device === 'desktop').length}，平板 ${testers.filter((t) => t.device === 'tablet').length}）`,
    '',
    '## 假设判定',
    '',
    '| 假设 | 达标 | 比例 | 阈值 | 判定 | 依据 |',
    '|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.passed}/${r.known}${r.known < r.total ? `（共 ${r.total}）` : ''} | ${r.share === null ? '—' : `${Math.round(r.share * 100)}%`} | ≥${Math.round(r.threshold * 100)}% | **${r.verdict}** | ${r.why} |`,
    ),
    '',
    '## 每位测试者',
    '',
    '| 测试者 | 设备 | 首笔(秒) | 求助 | H1 | 自由段(分) | 自由段创造 | 其中无提示 | H2 | 录制 | 保存 | 问怎么发 | H3 | 一句话(AI) | 撤销 | 停手前最后一个动作 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...testers.map((t) =>
      [
        t.tester,
        t.device,
        t.firstStrokeMs === null ? '—' : (t.firstStrokeMs / 1000).toFixed(1),
        yn(t.askedForHelp),
        yn(t.h1),
        t.freeMinutes ?? '—',
        t.freeCreations,
        t.unpromptedFreeCreations,
        yn(t.h2),
        t.recordings,
        t.saves,
        yn(t.askedToSend),
        yn(t.h3),
        `${t.textSubmits}(${t.aiAnswered})`,
        t.undos,
        t.lastActionBeforeStop ?? '—',
      ].join(' | ').replace(/^/, '| ').concat(' |'),
    ),
    '',
    '「?」表示观察记录里没有这一项。阈值见 docs/02 §1，判定规则见 docs/07。',
    '',
  ];
  return lines.join('\n');
}
