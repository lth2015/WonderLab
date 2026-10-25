// Event log for moderated tests (docs/02 §8). It stays in memory on this
// device: nothing is sent anywhere, and nothing the user writes or draws is
// recorded, only event types, times and a few non-personal fields. The
// moderator exports it at the end of a session with a hidden shortcut.
// In a field build the same events are also kept on the device across
// visits (lib/study-log.ts), for the tester to export by choice (Study.tsx).
// Every export says which build it came from (build.ts).

export type EventType =
  | 'world_ready'
  | 'first_stroke'
  | 'demo_shown'
  | 'stroke_classified'
  | 'create'
  | 'emerge'
  | 'return'
  | 'replay'
  | 'gift_sent'
  | 'gift_shown'
  | 'gift_accepted'
  | 'gift_released'
  | 'gift_failed'
  | 'touch'
  | 'text_submit'
  | 'hint_shown'
  | 'hint_followed'
  | 'undo'
  | 'restart'
  | 'save'
  | 'tier_change'
  | 'phase_change'
  | 'record_start'
  | 'record_complete';

export interface LoggedEvent {
  t: number; // ms since the page started
  type: EventType;
  [field: string]: string | number | boolean;
}

type Fields = Record<string, string | number | boolean>;

import { noteCreation } from './lib/visits';
import { BUILD, FIELD_BUILD } from './build';
import { keepFields, storeEvent } from './lib/study-log';

// "Unprompted" is pre-registered in docs/02 §1: not within 10 s of a hint
// that invited it. The H2 threshold is judged against this, so it must not drift.
export const PROMPT_WINDOW_MS = 10000;

const events: LoggedEvent[] = [];
const hintsShown = new Map<string, number>(); // hint id -> time shown
let phase: 'guided' | 'free' = 'guided';
/** How many events the last export contained, so a reset can warn about the rest. */
let exportedCount = 0;

/** Which creation each hint invites; used for `prompted` and `hint_followed`. */
const HINT_INVITES: Record<string, string> = {
  draw_lake: 'fish',
  touch_fish: 'touch_fish',
  draw_circle: 'moon',
  write_words: 'text_submit',
};

export function logEvent(type: EventType, fields: Fields = {}): void {
  // Both logs keep only the fields listed for the type (study-log.ts STUDY_FIELDS).
  events.push({ t: Math.round(performance.now()), type, ...keepFields(type, fields) });
  if (FIELD_BUILD) storeEvent(type, fields);
  // The diary study only counts what was made, never what (lib/visits.ts).
  if (type === 'create' || type === 'text_submit') noteCreation();
}

export function hintShown(id: string): void {
  hintsShown.set(id, performance.now());
  logEvent('hint_shown', { hint: id });
}

/**
 * Whether an action follows a recent hint that invited it. Logs
 * `hint_followed` the first time it does.
 */
export function prompted(action: string): boolean {
  const now = performance.now();
  for (const [hint, at] of hintsShown) {
    if (HINT_INVITES[hint] !== action || now - at > PROMPT_WINDOW_MS) continue;
    hintsShown.delete(hint);
    logEvent('hint_followed', { hint, after: Math.round(now - at) });
    return true;
  }
  return false;
}

export function currentPhase(): 'guided' | 'free' {
  return phase;
}

/** Whether anything has been logged since the last export. */
export function hasUnexported(): boolean {
  return events.length > exportedCount;
}

export function togglePhase(): 'guided' | 'free' {
  phase = phase === 'guided' ? 'free' : 'guided';
  logEvent('phase_change', { phase });
  return phase;
}

export function deviceType(): string {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  return coarse ? (small ? 'phone' : 'tablet') : 'desktop';
}

/**
 * Hand the log over as JSON: through the share sheet on a phone (to AirDrop,
 * mail or a chat with yourself), as a download elsewhere.
 */
export async function exportLog(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const count = events.length;
  const name = `wonderlab-session-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), device: deviceType(), build: BUILD, events }, null, 2)], {
    type: 'application/json',
  });
  const file = new File([blob], name, { type: 'application/json' });
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      exportedCount = count;
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  exportedCount = count;
  return 'downloaded';
}

/** For tests in the browser console. */
export function readLog(): readonly LoggedEvent[] {
  return events;
}
