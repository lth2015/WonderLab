// Reading moderated-test logs against the pre-registered hypotheses
// (docs/02 §1, §8). Input is what the moderator exports at the end of each
// session (src/telemetry.ts exportLog) plus, optionally, the observer's notes
// on the two things a log cannot see: asking for help before the first
// stroke, and asking how to send the work to someone.
//
// Each hypothesis comes out 成立 / 不成立 / 不确定. Where the notes are
// missing, a tester's answer is unknown rather than guessed, and the verdict
// is only decided when no way of filling in the unknowns could change it.

export interface SessionEvent {
  t: number;
  type: string;
  [field: string]: string | number | boolean;
}

export interface SessionLog {
  exportedAt?: string;
  device?: string;
  events: SessionEvent[];
}

/** The observer's notes for one tester. Omitted fields are unknown. */
export interface ObserverNotes {
  helpBeforeFirstStroke?: boolean;
  askedToSend?: boolean;
}

export type Verdict = '成立' | '不成立' | '不确定';

export const H1_FIRST_STROKE_MS = 5000;
export const H1_SHARE = 0.8;
export const H2_UNPROMPTED = 3;
export const H2_SHARE = 0.6;
export const H3_SHARE = 0.3;
/** An undo this soon after its creation suggests the stroke was misread. */
export const QUICK_UNDO_MS = 3000;

export interface TesterResult {
  id: string;
  device: string;
  firstStrokeMs: number | null;
  /** Minutes spent in the free phase, or null when the log has none. */
  freeMinutes: number | null;
  unpromptedInFree: number;
  promptedInFree: number;
  saves: number;
  recordsStarted: number;
  recordsCompleted: number;
  quickUndos: Record<string, number>;
  textSources: Record<string, number>;
  /** true / false, or null when the answer needs notes that are missing. */
  h1: boolean | null;
  h2: boolean | null;
  h3: boolean | null;
}

/** Whether a log looks like one exported by this app. */
export function isSessionLog(data: unknown): data is SessionLog {
  if (typeof data !== 'object' || data === null) return false;
  const events = (data as { events?: unknown }).events;
  return Array.isArray(events) && events.every((e) => typeof e === 'object' && e !== null && typeof e.t === 'number' && typeof e.type === 'string');
}

/** The [start, end) spans of the free phase; the guided phase is the default. */
export function freeSpans(events: SessionEvent[]): [number, number][] {
  const spans: [number, number][] = [];
  let since: number | null = null;
  for (const e of events) {
    if (e.type !== 'phase_change') continue;
    if (e.phase === 'free' && since === null) since = e.t;
    else if (e.phase === 'guided' && since !== null) {
      spans.push([since, e.t]);
      since = null;
    }
  }
  if (since !== null) spans.push([since, Math.max(since, ...events.map((e) => e.t)) + 1]);
  return spans;
}

const bump = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};

export function analyzeTester(id: string, log: SessionLog, notes: ObserverNotes = {}): TesterResult {
  const events = [...log.events].sort((a, b) => a.t - b.t);
  const first = events.find((e) => e.type === 'first_stroke');
  const firstStrokeMs = first && typeof first.after === 'number' ? first.after : null;

  const spans = freeSpans(events);
  const inFree = (t: number) => spans.some(([a, b]) => t >= a && t < b);
  let unpromptedInFree = 0;
  let promptedInFree = 0;
  const quickUndos: Record<string, number> = {};
  const textSources: Record<string, number> = {};
  let saves = 0;
  let recordsStarted = 0;
  let recordsCompleted = 0;
  for (const e of events) {
    // A creation is a new thing in the world, or a sentence that changed it.
    if ((e.type === 'create' || e.type === 'text_submit') && inFree(e.t)) {
      if (e.prompted === true) promptedInFree += 1;
      else unpromptedInFree += 1;
    }
    if (e.type === 'text_submit') bump(textSources, String(e.source ?? 'unknown'));
    if (e.type === 'undo' && typeof e.after === 'number' && e.after <= QUICK_UNDO_MS) bump(quickUndos, String(e.kind));
    if (e.type === 'save' && e.how !== 'cancelled') saves += 1;
    if (e.type === 'record_start') recordsStarted += 1;
    if (e.type === 'record_complete') recordsCompleted += 1;
  }

  let h1: boolean | null;
  if (firstStrokeMs === null || firstStrokeMs > H1_FIRST_STROKE_MS || notes.helpBeforeFirstStroke === true) h1 = false;
  else h1 = notes.helpBeforeFirstStroke === false ? true : null;

  const freeMinutes = spans.length ? spans.reduce((s, [a, b]) => s + (b - a), 0) / 60000 : null;
  const h2 = freeMinutes === null ? null : unpromptedInFree >= H2_UNPROMPTED;

  let h3: boolean | null;
  if (saves > 0 || notes.askedToSend === true) h3 = true;
  else h3 = notes.askedToSend === false ? false : null;

  const world = events.find((e) => e.type === 'world_ready');
  return {
    id,
    device: String(world?.device ?? log.device ?? 'unknown'),
    firstStrokeMs,
    freeMinutes,
    unpromptedInFree,
    promptedInFree,
    saves,
    recordsStarted,
    recordsCompleted,
    quickUndos,
    textSources,
    h1,
    h2,
    h3,
  };
}

export interface HypothesisResult {
  verdict: Verdict;
  /** Testers who met the criterion. */
  met: number;
  /** Testers whose answer is unknown (missing notes or no free phase). */
  unknown: number;
  total: number;
  threshold: number;
}

/**
 * Met by at least `share` of all testers. Decided only when the unknowns
 * cannot tip it: 成立 if it holds even with every unknown failing, 不成立 if
 * it fails even with every unknown passing, otherwise 不确定.
 */
export function judge(answers: (boolean | null)[], share: number): HypothesisResult {
  const total = answers.length;
  const met = answers.filter((a) => a === true).length;
  const unknown = answers.filter((a) => a === null).length;
  let verdict: Verdict = '不确定';
  if (total > 0 && met / total >= share) verdict = '成立';
  else if (total > 0 && (met + unknown) / total < share) verdict = '不成立';
  return { verdict, met, unknown, total, threshold: share };
}

export interface StudyResult {
  testers: TesterResult[];
  h1: HypothesisResult;
  h2: HypothesisResult;
  h3: HypothesisResult;
  warnings: string[];
}

export function analyzeStudy(sessions: { id: string; log: SessionLog; notes?: ObserverNotes }[]): StudyResult {
  const testers = sessions.map((s) => analyzeTester(s.id, s.log, s.notes));
  const warnings: string[] = [];
  if (testers.length < 5) warnings.push(`只有 ${testers.length} 份记录；方案是 5–10 名测试者，结论只作方向参考。`);
  const noFree = testers.filter((t) => t.freeMinutes === null).map((t) => t.id);
  if (noFree.length) warnings.push(`没有自由段的记录（主持人没按切换键？）：${noFree.join('、')}。这些人的 H2 记为未知。`);
  return {
    testers,
    h1: judge(testers.map((t) => t.h1), H1_SHARE),
    h2: judge(testers.map((t) => t.h2), H2_SHARE),
    h3: judge(testers.map((t) => t.h3), H3_SHARE),
    warnings,
  };
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—');
const yn = (v: boolean | null) => (v === null ? '?' : v ? '✓' : '✗');
const counts = (m: Record<string, number>) =>
  Object.entries(m)
    .map(([k, v]) => `${k}×${v}`)
    .join(' ') || '—';

/** A Markdown report for the validation write-up (docs/02 §9, stage D). */
export function formatReport(r: StudyResult): string {
  const line = (name: string, rule: string, h: HypothesisResult) =>
    `| ${name} | ${rule} | ${h.met}/${h.total}（${pct(h.met, h.total)}）${h.unknown ? `，未知 ${h.unknown}` : ''} | ≥${Math.round(h.threshold * 100)}% | **${h.verdict}** |`;
  const out = [
    '# 主持式测试结果',
    '',
    '| 假设 | 判定规则（docs/02 §1） | 达到的人 | 阈值 | 结论 |',
    '|---|---|---|---|---|',
    line('H1', `${H1_FIRST_STROKE_MS / 1000} 秒内、无求助落下第一笔`, r.h1),
    line('H2', `自由段内 ≥${H2_UNPROMPTED} 次无提示创造`, r.h2),
    line('H3', '主动保存，或询问如何发送', r.h3),
    '',
  ];
  if (r.warnings.length) out.push(...r.warnings.map((w) => `> ${w}`), '');
  out.push(
    '## 每位测试者',
    '',
    '| 记录 | 设备 | 首笔 | 自由段 | 无提示 / 有提示创造 | 保存 | 录制完成 | 3 秒内撤销 | 一句成境来源 | H1 | H2 | H3 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...r.testers.map(
      (t) =>
        `| ${t.id} | ${t.device} | ${t.firstStrokeMs === null ? '—' : `${(t.firstStrokeMs / 1000).toFixed(1)}s`} | ${
          t.freeMinutes === null ? '—' : `${t.freeMinutes.toFixed(1)} 分`
        } | ${t.unpromptedInFree} / ${t.promptedInFree} | ${t.saves} | ${t.recordsCompleted}/${t.recordsStarted} | ${counts(t.quickUndos)} | ${counts(
          t.textSources,
        )} | ${yn(t.h1)} | ${yn(t.h2)} | ${yn(t.h3)} |`,
    ),
    '',
    '「?」表示需要观察员记录才能判断（是否求助、是否问怎么发送），或这份记录没有自由段。',
    '「3 秒内撤销」按被撤销的类型计数，是判定出错的信号。',
  );
  return out.join('\n') + '\n';
}
