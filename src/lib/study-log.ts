// The field-build event store (docs/验证路线图.md §4): in a build handed to
// testers outside the office (poc-r1, poc-gift-r1), events are also kept on
// the device, across visits, so a tester can choose days later to export
// them. Nothing here is sent anywhere. The events are the same content-free
// records as the moderator's log: event types, times and a few non-personal
// fields — never what was drawn or written, never a link.

const KEY = 'wonderlab.study';
const MAX = 3000;

export interface StoredEvent {
  /** ms since the epoch, so events from different visits line up. */
  t: number;
  type: string;
  [field: string]: string | number | boolean;
}

/** Events not yet written: writing the whole list on every event would stall drawing on a phone. */
let pending: StoredEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 2000;

function readStored(): StoredEvent[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((e) => e && typeof e.t === 'number' && typeof e.type === 'string') : [];
  } catch {
    return [];
  }
}

/** Everything kept so far, including what is still waiting to be written. */
export function readStudy(): StoredEvent[] {
  return [...readStored(), ...pending].slice(-MAX);
}

/** Write what is waiting, in one go. Also runs when the page is hidden or closed. */
export function flushStudy(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (!pending.length) return;
  const list = readStudy();
  pending = [];
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or private mode: the moderator's in-memory log still has it.
  }
}

export function storeEvent(e: StoredEvent): void {
  pending.push(e);
  if (timer === null) timer = setTimeout(flushStudy, FLUSH_MS);
}

export function clearStudy(): void {
  pending = [];
  if (timer !== null) clearTimeout(timer);
  timer = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('pagehide', flushStudy);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStudy();
  });
}
