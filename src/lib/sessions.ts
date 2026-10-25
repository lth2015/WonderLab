// Reading moderated-test logs against the pre-registered hypotheses
// (docs/02 §1, §8). Input is what the moderator exports at the end of each
// session (src/telemetry.ts exportLog) plus, optionally, the observer's notes
// on what a log cannot see: help before the first stroke, and whether
// saving or asking how to send was spontaneous before the interview.
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
  /** Legacy: lacks provenance; retained for reading old notes, never scores H3. */
  askedToSend?: boolean;
  /** Frozen before log export/interview. Missing or invalid evidence is unknown. */
  h3Observation?: {
    status: 'spontaneous' | 'prompted_only' | 'not_observed' | 'unknown';
    /** Required for a negative: no missing portion of the observation window. */
    windowComplete?: boolean;
    /** Action/quote, phase/time, and whether any moderator question preceded it. */
    evidence?: string;
  };
}

export type Verdict = '成立' | '不成立' | '不确定';

export const H1_FIRST_STROKE_MS = 5000;
export const H1_SHARE = 0.8;
export const H2_UNPROMPTED = 3;
export const H2_SHARE = 0.6;
export const H3_SHARE = 0.3;
/** An undo this soon after its creation suggests the stroke was misread. */
export const QUICK_UNDO_MS = 3000;
/** After the first fish, a pause this long before creating again counts as watching (docs/02 §8). */
export const WATCH_MS = 10000;

/**
 * What a tester did right after their first fish: created again at once
 * (创造的乐趣), stopped to watch or touch it first (陪伴的乐趣), or never
 * created again. Descriptive, no threshold.
 */
export interface AfterFirstFish {
  kind: 'create' | 'watch' | 'none';
  /** Until the next creation or sentence, ms; null when there was none. */
  gapMs: number | null;
  /** Touched a fish before creating again. */
  touched: boolean;
}

/**
 * 送一条鱼 (docs/02 §5.7): did someone who took in a sent fish go on to make
 * their own? The experiment's question — whether one person's imagining
 * became the starting point of another's. Null when no gift was taken in.
 */
export function afterGift(events: SessionEvent[]): { createdOwnFish: boolean; afterMs: number | null } | null {
  const i = events.findIndex((e) => e.type === 'gift_accepted');
  if (i < 0) return null;
  const own = events.slice(i + 1).find((e) => e.type === 'create' && e.what === 'fish');
  return { createdOwnFish: !!own, afterMs: own ? own.t - events[i].t : null };
}

export function afterFirstFish(events: SessionEvent[]): AfterFirstFish | null {
  const i = events.findIndex((e) => e.type === 'create' && e.what === 'fish');
  if (i < 0) return null;
  const t0 = events[i].t;
  let touched = false;
  for (const e of events.slice(i + 1)) {
    if (e.type === 'touch' && e.object === 'fish') touched = true;
    if (e.type === 'create' || e.type === 'text_submit') {
      const gapMs = e.t - t0;
      return { kind: touched || gapMs >= WATCH_MS ? 'watch' : 'create', gapMs, touched };
    }
  }
  return { kind: 'none', gapMs: null, touched };
}

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
  afterFirstFish: AfterFirstFish | null;
  afterGift: { createdOwnFish: boolean; afterMs: number | null } | null;
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

  // Logs show that a save happened, not why. Legacy askedToSend also
  // conflates unsolicited requests with interview answers. Neither can
  // establish spontaneity (or its absence) without an observer attestation.
  const observation = notes.h3Observation;
  const hasEvidence = typeof observation?.evidence === 'string' && observation.evidence.trim().length > 0;
  let h3: boolean | null = null;
  if (hasEvidence && observation?.status === 'spontaneous') h3 = true;
  else if (hasEvidence && observation?.windowComplete === true &&
    (observation.status === 'prompted_only' || observation.status === 'not_observed')) h3 = false;

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
    afterFirstFish: afterFirstFish(events),
    afterGift: afterGift(events),
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
  const unknownH3 = testers.filter((t) => t.h3 === null).map((t) => t.id);
  if (unknownH3.length) warnings.push(`H3 主动性证据缺失或不明：${unknownH3.join('、')}。旧 askedToSend 和 save 事件不自动计为成功；这些记录保留在总人数中并记为未知。`);
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
    '| 记录 | 设备 | 首笔 | 自由段 | 无提示 / 有提示创造 | 保存（含被提示） | 录制完成 | 3 秒内撤销 | 一句成境来源 | H1 | H2 | H3 |',
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
    '「?」表示需要观察员证据才能判断，或这份记录没有自由段。H3 仅使用有证据的 h3Observation；保存次数、录制完成和旧 askedToSend 不证明主动性。',
    'H3 未知仍纳入总人数：成立需已确认成功/总人数 ≥30%；不成立需（成功+未知）/总人数 <30%；否则不确定。',
    '「3 秒内撤销」按被撤销的类型计数，是判定出错的信号。',
    '',
    '## 第一条鱼之后（创造的乐趣 / 陪伴的乐趣）',
    '',
    `画出第一条鱼后：${WATCH_MS / 1000} 秒内、没点鱼就接着创造，记为「接着画」；先点了鱼，或停了 ${WATCH_MS / 1000} 秒以上才再创造，记为「先看」；之后再没有创造，记为「没再画」。只作描述，不设门槛。`,
    '',
    '| 记录 | 第一条鱼之后 | 到下一次创造 | 先点了鱼 |',
    '|---|---|---|---|',
    ...r.testers.map((t) => {
      const a = t.afterFirstFish;
      if (!a) return `| ${t.id} | 没有画鱼 | — | — |`;
      const kind = { create: '接着画', watch: '先看', none: '没再画' }[a.kind];
      return `| ${t.id} | ${kind} | ${a.gapMs === null ? '—' : `${(a.gapMs / 1000).toFixed(1)}s`} | ${a.touched ? '是' : '否'} |`;
    }),
  );
  const gifted = r.testers.filter((t) => t.afterGift);
  if (gifted.length) {
    out.push(
      '',
      '## 收到一条鱼之后（送一条鱼实验，02 §5.7）',
      '',
      '收下别人送的鱼之后，有没有在自己的湖里画出第一条自己的鱼。',
      '',
      '| 记录 | 画了自己的鱼 | 收下之后多久 |',
      '|---|---|---|',
      ...gifted.map((t) => `| ${t.id} | ${t.afterGift!.createdOwnFish ? '是' : '否'} | ${t.afterGift!.afterMs === null ? '—' : `${(t.afterGift!.afterMs / 1000).toFixed(1)}s`} |`),
    );
  }
  return out.join('\n') + '\n';
}
