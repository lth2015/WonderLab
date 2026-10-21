// Event log for moderated tests (docs/02 §8). It stays in memory on this
// device: nothing is sent anywhere, and nothing the user writes or draws is
// recorded, only event types, times and a few non-personal fields. The
// moderator exports it at the end of a session with a hidden shortcut.

export type EventType =
  | 'world_ready'
  | 'first_stroke'
  | 'stroke_classified'
  | 'create'
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

const PROMPT_WINDOW_MS = 20000;

const events: LoggedEvent[] = [];
const hintsShown = new Map<string, number>(); // hint id -> time shown
let phase: 'guided' | 'free' = 'guided';

/** Which creation each hint invites; used for `prompted` and `hint_followed`. */
const HINT_INVITES: Record<string, string> = {
  draw_lake: 'fish',
  touch_fish: 'touch_fish',
  draw_circle: 'moon',
  write_words: 'text_submit',
};

export function logEvent(type: EventType, fields: Fields = {}): void {
  events.push({ t: Math.round(performance.now()), type, ...fields });
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

/** Download the log as JSON. */
export function exportLog(): void {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), device: deviceType(), events }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wonderlab-session-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** For tests in the browser console. */
export function readLog(): readonly LoggedEvent[] {
  return events;
}
