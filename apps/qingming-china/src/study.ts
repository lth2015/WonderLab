import { PAGES } from './content';
import type { GameState, QuestId } from './game';

type Method = 'system' | 'system_link' | 'link';
export type ErrorCode = 'save_read_failed' | 'save_write_failed' | 'save_import_failed' | 'postcard_export_failed' | 'audio_failed' | 'unexpected_error';
type Events = {
  world_entered: { source: 'direct' | 'journal' };
  first_interaction_completed: { interaction_id: QuestId | 'tea' | 'observation'; elapsed_ms: number };
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
const quests: QuestId[] = ['paper', 'boat', 'purse', 'harbor', 'gate'];
const page = inList(PAGES.map(p => p.id));
const schemas: Record<keyof Events, Record<string, (v: unknown) => boolean>> = {
  world_entered: { source: inList(['direct', 'journal']) },
  first_interaction_completed: { interaction_id: inList([...quests, 'tea', 'observation']), elapsed_ms: positive },
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

/** Ephemeral local memory only. No persistence, visitor identity, network or SDK. */
export function createStudy(environment: string, buildId: string, receiver?: (event: StudyEvent) => void) {
  const events: StudyEvent[] = [], seen = new Set<string>(), sessionId = randomId(), startedAt = performance.now();
  let dropped = 0;
  return {
    elapsed: () => Math.max(0, Math.round(performance.now() - startedAt)),
    has: (key: string) => seen.has(key),
    emit<K extends keyof Events>(type: K, fields: Events[K], once?: string): boolean {
      if (once && seen.has(once)) return false;
      const kept: Record<string, unknown> = {};
      for (const [key, valid] of Object.entries(schemas[type])) {
        const value = (fields as Record<string, unknown>)[key];
        if (!valid(value)) return false;
        kept[key] = value;
      }
      if (once) seen.add(once);
      const event: StudyEvent = { event_id: randomId(), session_id: sessionId, schema_version: 1, occurred_at: new Date().toISOString(), elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)), environment, world_id: 'qingming-china', build_id: buildId, type, ...kept };
      if (events.length === 1000) { events.shift(); dropped++; }
      events.push(event);
      try { receiver?.(structuredClone(event)); } catch { /* optional debug receiver never breaks the game */ }
      return true;
    },
    snapshot: () => ({ schema_version: 1, session_id: sessionId, environment, world_id: 'qingming-china', build_id: buildId, dropped, events: structuredClone(events) }),
  };
}
export const study = createStudy(import.meta.env.MODE, import.meta.env.VITE_QINGMING_BUILD_ID || 'unversioned');
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
