import type { QuestState, SaveData } from '../contract';
import { GUIDE_STOPS, PAGES } from '../content/world';
import { SESSION_STUDY_KEY } from './save';
import { SESSION_MODE } from './session';

// 試遊の記録 (spec 計測: 入場、初回の有効操作、小話の開始と完了、絵巻帳の閲覧、
// 保存の試行と結果、再訪、エラー). The same event names and fields as the China
// work (codex/china-playtest-time, docs/painted-worlds/china-playtest-v1/), so
// the two works can be read side by side. Local memory only: no storage key,
// no network, no visitor id, no save contents, no free text. The player exports
// it from 設定 on purpose; a download request is not "sent to anyone".
// 試遊会 (?session=1) alone keeps it in this browser under
// ww:qingming-edo:study:session until 「次の方へ」 (engine/session.ts).

export type QuestId = 'kaze' | 'dougu' | 'tenugui';
type Method = 'system' | 'system_link' | 'link';
export type ErrorCode = 'save_read_failed' | 'save_write_failed' | 'save_import_failed' | 'postcard_export_failed' | 'audio_failed' | 'unexpected_error';
type Events = {
  world_entered: { source: 'direct' | 'journal' };
  first_interaction_completed: { interaction_id: QuestId | 'observation'; elapsed_ms: number };
  story_started: { story_id: QuestId };
  story_completed: { story_id: QuestId; first_completion: boolean };
  journal_opened: { page_count: number };
  journal_export_attempted: { page_id: string; export_type: 'png' };
  journal_export_completed: { page_id: string; export_type: 'png'; stage: 'download_requested' };
  share_attempted: { page_id: string; method: Method };
  share_result: { method: Method; result: 'invoked' | 'cancelled' | 'copied' | 'unavailable' | 'failed' };
  revisit: { has_progress: boolean };
  error: { code: ErrorCode };
  /** 通りの案内: a stop chosen (not a story step, not a first interaction). */
  guide_stop_selected: { stop_id: string };
};
export type StudyEvent = { event_id: string; session_id: string; schema_version: 1; occurred_at: string; elapsed_ms: number; environment: string; world_id: 'qingming-edo'; build_id: string; type: keyof Events; [key: string]: unknown };

const QUESTS: QuestId[] = ['kaze', 'dougu', 'tenugui'];
const inList = (xs: readonly unknown[]) => (v: unknown) => xs.includes(v);
const nonNegative = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const page = inList(PAGES.map((p) => p.id));
const schemas: Record<keyof Events, Record<string, (v: unknown) => boolean>> = {
  world_entered: { source: inList(['direct', 'journal']) },
  first_interaction_completed: { interaction_id: inList([...QUESTS, 'observation']), elapsed_ms: nonNegative },
  story_started: { story_id: inList(QUESTS) },
  story_completed: { story_id: inList(QUESTS), first_completion: (v) => typeof v === 'boolean' },
  journal_opened: { page_count: (v) => nonNegative(v) && (v as number) <= 12 },
  journal_export_attempted: { page_id: page, export_type: inList(['png']) },
  journal_export_completed: { page_id: page, export_type: inList(['png']), stage: inList(['download_requested']) },
  share_attempted: { page_id: page, method: inList(['system', 'system_link', 'link']) },
  share_result: { method: inList(['system', 'system_link', 'link']), result: inList(['invoked', 'cancelled', 'copied', 'unavailable', 'failed']) },
  revisit: { has_progress: (v) => typeof v === 'boolean' },
  guide_stop_selected: { stop_id: inList(GUIDE_STOPS.map((g) => g.id)) },
  error: { code: inList(['save_read_failed', 'save_write_failed', 'save_import_failed', 'postcard_export_failed', 'audio_failed', 'unexpected_error']) },
};
const randomId = () => globalThis.crypto?.randomUUID?.() ?? 'event-' + Date.now() + '-' + Math.random().toString(36).slice(2);

/** Where a 試遊会 player's log survives a reload. Normal play keeps it in memory only. */
export type StudyKeep = { store: { getItem(k: string): string | null; setItem(k: string, v: string): void }; key: string };
type Kept = { session_id: string; started_wall: number; dropped: number; seen: string[]; events: StudyEvent[] };

function restore(keep: StudyKeep | undefined): Kept | null {
  if (!keep) return null;
  try {
    const k = JSON.parse(keep.store.getItem(keep.key) ?? 'null') as Kept | null;
    if (!k || typeof k.session_id !== 'string' || typeof k.started_wall !== 'number' || !Array.isArray(k.events) || !Array.isArray(k.seen)) return null;
    // only events of this session and this work
    const events = k.events.filter((e) => e && e.session_id === k.session_id && e.world_id === 'qingming-edo').slice(-1000);
    return { session_id: k.session_id, started_wall: k.started_wall, dropped: Number(k.dropped) || 0, seen: k.seen.filter((x) => typeof x === 'string'), events };
  } catch {
    return null;
  }
}

export function createStudy(environment: string, buildId: string, now: () => number = () => performance.now(), keep?: StudyKeep, wall: () => number = Date.now) {
  const prior = restore(keep);
  const events: StudyEvent[] = prior?.events ?? [];
  const seen = new Set<string>(prior?.seen ?? []);
  const sessionId = prior?.session_id ?? randomId();
  // kept: count from when this player started, across reloads (wall clock)
  const startedWall = prior?.started_wall ?? wall();
  const startedAt = now();
  let dropped = prior?.dropped ?? 0;
  const elapsed = () => Math.max(0, Math.round(keep ? wall() - startedWall : now() - startedAt));
  const save = () => {
    if (!keep) return;
    try {
      keep.store.setItem(keep.key, JSON.stringify({ session_id: sessionId, started_wall: startedWall, dropped, seen: [...seen], events } satisfies Kept));
    } catch {
      // storage full or blocked: the log still lives in memory
    }
  };
  return {
    elapsed,
    emit<K extends keyof Events>(type: K, fields: Events[K], once?: string): boolean {
      if (once && seen.has(once)) return false;
      const kept: Record<string, unknown> = {};
      for (const [key, valid] of Object.entries(schemas[type])) {
        const value = (fields as Record<string, unknown>)[key];
        if (!valid(value)) return false; // never record a field outside the list
        kept[key] = value;
      }
      if (once) seen.add(once);
      const event: StudyEvent = { event_id: randomId(), session_id: sessionId, schema_version: 1, occurred_at: new Date().toISOString(), elapsed_ms: elapsed(), environment, world_id: 'qingming-edo', build_id: buildId, type, ...kept };
      if (events.length === 1000) {
        events.shift();
        dropped++;
      }
      events.push(event);
      save();
      return true;
    },
    snapshot: () => ({ schema_version: 1, session_id: sessionId, environment, world_id: 'qingming-edo' as const, build_id: buildId, dropped, events: structuredClone(events) }),
  };
}
export type Study = ReturnType<typeof createStudy>;

function sessionKeep(): StudyKeep | undefined {
  if (!SESSION_MODE) return undefined;
  try {
    return { store: localStorage, key: SESSION_STUDY_KEY };
  } catch {
    return undefined;
  }
}
export const study = createStudy(
  SESSION_MODE ? 'playtest-session' : (import.meta.env?.MODE ?? 'test'),
  (import.meta.env?.VITE_EDO_BUILD_ID as string | undefined) || 'unversioned',
  undefined,
  sessionKeep(),
);

const ORDER: QuestState[] = ['undiscovered', 'discovered', 'active', 'ready', 'complete'];
const at = (s: SaveData, q: QuestId) => ORDER.indexOf(s.progress.quests[q] ?? 'undiscovered');

/** Some progress in a save: a page, a met person, or a story under way. */
export function hasPlayableProgress(s: SaveData): boolean {
  return s.journal.pages.length > 0 || s.progress.flags.length > 0 || QUESTS.some((q) => at(s, q) > 0);
}

/**
 * Called for the player's own committed actions only; never for loading,
 * importing or resetting a save. A story "starts" at its first real step
 * (active), and "completes" on the move to complete.
 */
export function observeProgress(before: SaveData, after: SaveData, recorder: Study = study): void {
  const active = ORDER.indexOf('active');
  for (const q of QUESTS) {
    const a = at(before, q);
    const b = at(after, q);
    if (b > a) recorder.emit('first_interaction_completed', { interaction_id: q, elapsed_ms: recorder.elapsed() }, 'first-interaction');
    if (a < active && b >= active) recorder.emit('story_started', { story_id: q });
    if (a < ORDER.indexOf('complete') && b === ORDER.indexOf('complete')) {
      recorder.emit('story_completed', { story_id: q, first_completion: !before.wallet.grantedRewardIds.includes(q) });
    }
  }
}
