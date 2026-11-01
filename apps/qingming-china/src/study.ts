import { PAGES } from './content';
import type { GameState, QuestId } from './game';

type Source = 'direct' | 'journal';
type Method = 'system' | 'link';
type Events = {
  world_entered: { source: Source };
  first_interaction_completed: { interaction_id: string; elapsed_ms: number };
  story_completed: { story_id: QuestId | 'night-lantern'; first_completion: boolean };
  journal_export_attempted: { page_id: string; export_type: 'png' };
  journal_export_completed: { page_id: string; export_type: 'png'; stage: 'download_requested' };
  share_attempted: { page_id: string; method: Method };
  share_result: { method: Method; result: 'invoked' | 'cancelled' | 'copied' | 'unavailable' | 'failed' };
  offer_viewed: { product_id: string; offer_version: number; placement: 'album' | 'summary' };
  interest_registered: { product_id: string; offer_version: number };
};
export type StudyEvent = { event_id: string; schema_version: 1; occurred_at: string; environment: string; world_id: 'qingming-china'; build_id: string; type: keyof Events; [key: string]: unknown };
const inList = (xs: readonly unknown[]) => (v: unknown) => xs.includes(v);
const positive = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const page = inList(PAGES.map(p => p.id));
const product = inList(['qingming-china-night-return']);
const schemas: Record<keyof Events, Record<string, (v: unknown) => boolean>> = {
  world_entered: { source: inList(['direct', 'journal']) },
  first_interaction_completed: { interaction_id: inList(['paper', 'boat', 'purse', 'harbor', 'tea', 'observation']), elapsed_ms: positive },
  story_completed: { story_id: inList(['paper', 'boat', 'purse', 'harbor', 'night-lantern']), first_completion: v => typeof v === 'boolean' },
  journal_export_attempted: { page_id: page, export_type: inList(['png']) },
  journal_export_completed: { page_id: page, export_type: inList(['png']), stage: inList(['download_requested']) },
  share_attempted: { page_id: page, method: inList(['system', 'link']) },
  share_result: { method: inList(['system', 'link']), result: inList(['invoked', 'cancelled', 'copied', 'unavailable', 'failed']) },
  offer_viewed: { product_id: product, offer_version: positive, placement: inList(['album', 'summary']) },
  interest_registered: { product_id: product, offer_version: positive },
};

/** Local memory only. No visitor identity, storage, network or third-party SDK. */
export function createStudy(environment: string, buildId: string, receiver?: (event: StudyEvent) => void) {
  const events: StudyEvent[] = [], seen = new Set<string>();
  let dropped = 0;
  return {
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
      const event: StudyEvent = { event_id: globalThis.crypto?.randomUUID?.() ?? 'event-' + Date.now() + '-' + Math.random().toString(36).slice(2), schema_version: 1, occurred_at: new Date().toISOString(), environment, world_id: 'qingming-china', build_id: buildId, type, ...kept };
      if (events.length === 1000) { events.shift(); dropped++; }
      events.push(event);
      // Debug receivers cannot break the game or mutate the retained event.
      try { receiver?.(structuredClone(event)); } catch { /* optional local receiver */ }
      return true;
    },
    snapshot: () => ({ schema_version: 1, environment, world_id: 'qingming-china', build_id: buildId, dropped, events: structuredClone(events) }),
  };
}

export const study = createStudy(import.meta.env.MODE, import.meta.env.VITE_QINGMING_BUILD_ID || 'development-unversioned');
const enteredAt = performance.now();
export function observeProgress(before: GameState, after: GameState) {
  const quests: QuestId[] = ['paper', 'boat', 'purse', 'harbor'];
  const interaction = quests.find(id => after.progress.quests[id].step > before.progress.quests[id].step)
    ?? (after.progress.ropes.length > before.progress.ropes.length ? 'boat' : undefined)
    ?? (!before.progress.tea && after.progress.tea ? 'tea' : undefined)
    ?? (after.progress.observations.length > before.progress.observations.length ? 'observation' : undefined);
  if (interaction) study.emit('first_interaction_completed', { interaction_id: interaction, elapsed_ms: Math.max(0, Math.round(performance.now() - enteredAt)) }, 'first-interaction');
  for (const id of quests) {
    if (before.progress.quests[id].status !== 'complete' && after.progress.quests[id].status === 'complete') {
      study.emit('story_completed', { story_id: id, first_completion: !before.claimed.includes(id) });
    }
  }
}
