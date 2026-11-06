import { SESSION_MODE, SESSION_STUDY_KEY } from './session';
import { PAGES } from './content';
import type { GameState, QuestId } from './game';

type Method = 'system' | 'system_link' | 'link';
export type ErrorCode = 'save_read_failed' | 'save_write_failed' | 'save_import_failed' | 'postcard_export_failed' | 'audio_failed' | 'unexpected_error';
type Events = {
  world_entered: { source: 'direct' | 'journal' };
  first_interaction_completed: { interaction_id: QuestId | 'tea' | 'observation'; elapsed_ms: number };
  play_detail: { what: 'trace' | 'ugoki' | 'map'; outcome: 'traced' | 'tapped' | 'left' | 'miss' | 'caught' | 'opened' };
  story_started: { story_id: QuestId };
  story_completed: { story_id: QuestId; first_completion: boolean };
  journal_opened: { page_count: number };
  journal_export_attempted: { page_id: string; export_type: 'png' };
  journal_export_completed: { page_id: string; export_type: 'png'; stage: 'download_requested' };
  share_attempted: { page_id: string; method: Method };
  share_result: { method: Method; result: 'invoked' | 'cancelled' | 'copied' | 'unavailable' | 'failed' };
  revisit: { has_progress: boolean };
  error: { code: ErrorCode };
};
export type StudyEvent = { event_id: string; session_id: string; schema_version: 1; occurred_at: string; elapsed_ms: number; environment: string; world_id: 'qingming-china'; build_id: string; type: keyof Events; [key: string]: unknown };
const inList = (xs: readonly unknown[]) => (v: unknown) => xs.includes(v);
const positive = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const quests: QuestId[] = ['paper', 'boat', 'purse', 'harbor', 'gate', 'countryside', 'trace', 'breeze'];
const page = inList(PAGES.map(p => p.id));
const schemas: Record<keyof Events, Record<string, (v: unknown) => boolean>> = {
  world_entered: { source: inList(['direct', 'journal']) },
  first_interaction_completed: { interaction_id: inList([...quests, 'tea', 'observation']), elapsed_ms: positive },
  play_detail: { what: inList(['trace', 'ugoki', 'map']), outcome: inList(['traced', 'tapped', 'left', 'miss', 'caught', 'opened']) },
  story_started: { story_id: inList(quests) },
  story_completed: { story_id: inList(quests), first_completion: v => typeof v === 'boolean' },
  journal_opened: { page_count: v => positive(v) && (v as number) <= PAGES.length },
  journal_export_attempted: { page_id: page, export_type: inList(['png']) },
  journal_export_completed: { page_id: page, export_type: inList(['png']), stage: inList(['download_requested']) },
  share_attempted: { page_id: page, method: inList(['system', 'system_link', 'link']) },
  share_result: { method: inList(['system', 'system_link', 'link']), result: inList(['invoked', 'cancelled', 'copied', 'unavailable', 'failed']) },
  revisit: { has_progress: v => typeof v === 'boolean' },
  error: { code: inList(['save_read_failed', 'save_write_failed', 'save_import_failed', 'postcard_export_failed', 'audio_failed', 'unexpected_error']) },
};
const randomId = () => globalThis.crypto?.randomUUID?.() ?? 'event-' + Date.now() + '-' + Math.random().toString(36).slice(2);

export type StudyKeep = { store: Pick<Storage, 'getItem' | 'setItem'>; key: string };
type Kept = { session_id: string; started_wall: number; dropped: number; seen: string[]; events: StudyEvent[] };
function cleanFields(type: string, fields: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.hasOwn(schemas, type)) return null;
  const schema = schemas[type as keyof Events];
  if (!schema) return null;
  const kept: Record<string, unknown> = {};
  for (const [key, valid] of Object.entries(schema)) {
    if (!valid(fields[key])) return null;
    kept[key] = fields[key];
  }
  return kept;
}
function restore(keep: StudyKeep | undefined, environment: string): Kept | null {
  if (!keep) return null;
  try {
    const raw = keep.store.getItem(keep.key);
    if (!raw || raw.length > 2_000_000) return null;
    const k = JSON.parse(raw);
    if (!k || typeof k.session_id !== 'string' || !k.session_id || k.session_id.length > 128 || typeof k.started_wall !== 'number' || !Number.isFinite(k.started_wall) || k.started_wall < 0 || !Array.isArray(k.events) || !Array.isArray(k.seen)) return null;
    const events: StudyEvent[] = [];
    for (const e of k.events) {
      if (!e || e.schema_version !== 1 || e.session_id !== k.session_id || e.world_id !== 'qingming-china' || typeof e.type !== 'string' || typeof e.event_id !== 'string' || !e.event_id || e.event_id.length > 128 || typeof e.occurred_at !== 'string' || !Number.isFinite(Date.parse(e.occurred_at)) || !positive(e.elapsed_ms) || typeof e.build_id !== 'string' || e.build_id.length > 128) continue;
      const fields = cleanFields(e.type, e);
      if (!fields) continue;
      events.push({ event_id: e.event_id, session_id: k.session_id, schema_version: 1, occurred_at: e.occurred_at, elapsed_ms: e.elapsed_ms, environment, world_id: 'qingming-china', build_id: e.build_id, type: e.type as keyof Events, ...fields });
    }
    if (k.events.length && !events.length) return null;
    return { session_id: k.session_id, started_wall: k.started_wall, dropped: (positive(k.dropped) ? k.dropped : 0) + Math.max(0, events.length - 1000), seen: k.seen.filter((key: unknown) => typeof key === 'string' && key.length <= 128).slice(-1000), events: events.slice(-1000) };
  } catch { return null; }
}

/** Normal visits use memory only; an explicit playtest keep survives refreshes. */
export function createStudy(environment: string, buildId: string, receiver?: (event: StudyEvent) => void, keep?: StudyKeep, wall: () => number = Date.now, now: () => number = () => performance.now()) {
  const prior = restore(keep, environment);
  const events: StudyEvent[] = prior?.events ?? [], seen = new Set<string>(prior?.seen ?? []);
  const sessionId = prior?.session_id ?? randomId(), startedWall = prior?.started_wall ?? wall(), startedAt = now();
  let dropped = prior?.dropped ?? 0;
  const elapsed = () => Math.max(0, Math.round(keep ? wall() - startedWall : now() - startedAt));
  const persist = () => {
    if (!keep) return;
    try { keep.store.setItem(keep.key, JSON.stringify({ session_id: sessionId, started_wall: startedWall, dropped, seen: [...seen], events } satisfies Kept)); } catch { /* blocked/full storage: retain the in-memory log */ }
  };
  return {
    elapsed,
    has: (key: string) => seen.has(key),
    emit<K extends keyof Events>(type: K, fields: Events[K], once?: string): boolean {
      if (once && seen.has(once)) return false;
      const kept = cleanFields(type, fields as Record<string, unknown>);
      if (!kept) return false;
      if (once) seen.add(once);
      const event: StudyEvent = { event_id: randomId(), session_id: sessionId, schema_version: 1, occurred_at: new Date().toISOString(), elapsed_ms: elapsed(), environment, world_id: 'qingming-china', build_id: buildId, type, ...kept };
      if (events.length === 1000) { events.shift(); dropped++; }
      events.push(event);
      persist();
      try { receiver?.(structuredClone(event)); } catch { /* optional debug receiver never breaks the game */ }
      return true;
    },
    snapshot: () => ({ schema_version: 1, session_id: sessionId, environment, world_id: 'qingming-china', build_id: buildId, dropped, events: structuredClone(events) }),
  };
}
function sessionKeep(): StudyKeep | undefined {
  if (!SESSION_MODE) return undefined;
  try { return { store: localStorage, key: SESSION_STUDY_KEY }; } catch { return undefined; }
}
export const study = createStudy(SESSION_MODE ? 'playtest-session' : import.meta.env.MODE, import.meta.env.VITE_QINGMING_BUILD_ID || 'unversioned', undefined, sessionKeep());
export function hasPlayableProgress(game: GameState): boolean {
  return game.started || game.journal.length > 0 || quests.some(id => game.progress.quests[id].step > 0) || game.progress.ropes.length > 0 || game.progress.observations.length > 0;
}
/** Call only for committed player actions, never for initial load/import/reset. */
export function observeProgress(before: GameState, after: GameState, recorder = study) {
  const progressed = quests.filter(id => after.progress.quests[id].step > before.progress.quests[id].step);
  const rope = after.progress.ropes.length > before.progress.ropes.length;
  const interaction = progressed[0] ?? (rope ? 'boat' : !before.progress.tea && after.progress.tea ? 'tea' : after.progress.observations.length > before.progress.observations.length ? 'observation' : null);
  if (interaction) recorder.emit('first_interaction_completed', { interaction_id: interaction, elapsed_ms: recorder.elapsed() }, 'first-interaction');
  for (const id of quests) {
    if ((before.progress.quests[id].step === 0 && after.progress.quests[id].step > 0 && !(id === 'boat' && before.progress.ropes.length > 0)) || (id === 'boat' && rope && before.progress.ropes.length === 0)) recorder.emit('story_started', { story_id: id });
    if (before.progress.quests[id].status !== 'complete' && after.progress.quests[id].status === 'complete') recorder.emit('story_completed', { story_id: id, first_completion: !before.claimed.includes(id) });
  }
}
