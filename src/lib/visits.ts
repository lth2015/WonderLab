// Visits, for the diary study (docs/02 §5.6, testkit/日记式测试.md): when the
// world was opened, for how long, and how many things were made. Kept in
// this browser only, with no content at all — nothing drawn or written —
// and handed over only when the moderator exports it on the tester's phone.

const KEY = 'wonderlab.visits';
const MAX = 300;
/** Hidden at least this long, and coming back counts as a new visit (mirrors time.ts TIME.awayMs). */
export const NEW_VISIT_MS = 30 * 60 * 1000;

export interface Visit {
  /** Opened, ms since the epoch. */
  at: number;
  /** Time on screen, ms (hidden time not counted). */
  ms: number;
  /** Creations and sentences during the visit. */
  creations: number;
}

let current: Visit | null = null;
/** On screen since (ms since the epoch); null while hidden. */
let shownSince: number | null = null;
let hiddenAt = 0;

function read(): Visit[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.at === 'number' && typeof x.ms === 'number' && typeof x.creations === 'number') : [];
  } catch {
    return [];
  }
}

function write(list: Visit[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Private mode or storage full: the diary simply is not kept.
  }
}

function flush(now: number): void {
  if (!current) return;
  if (shownSince !== null) {
    current.ms += now - shownSince;
    shownSince = now;
  }
  const list = read();
  const i = list.findIndex((v) => v.at === current!.at);
  if (i >= 0) list[i] = { ...current };
  else list.push({ ...current });
  write(list);
}

export function startVisit(now = Date.now()): void {
  current = { at: now, ms: 0, creations: 0 };
  shownSince = now;
  flush(now);
}

export function noteCreation(now = Date.now()): void {
  if (!current) return;
  current.creations += 1;
  flush(now);
}

/** The page was hidden or shown: hidden time does not count, and a long absence ends the visit. */
export function visibilityChanged(hidden: boolean, now = Date.now()): void {
  if (hidden) {
    flush(now);
    shownSince = null;
    hiddenAt = now;
    return;
  }
  if (hiddenAt && now - hiddenAt >= NEW_VISIT_MS) startVisit(now);
  else shownSince = now;
  hiddenAt = 0;
}

export function readVisits(): Visit[] {
  return read();
}

export function clearVisits(): void {
  current = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Hand the visits over as JSON: the share sheet on a phone, a download elsewhere. */
export async function exportVisits(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = `wonderful-world-visits-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), visits: read() }, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
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
  return 'downloaded';
}
