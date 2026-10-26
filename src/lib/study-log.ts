// The field-build event store (docs/验证路线图.md §5): in a build handed to
// testers outside the office (poc-r1, poc-gift-r1), events are also kept on
// the device, across visits, so a tester can choose days later to export
// them. Nothing here is sent anywhere.
//
// This is the one place events are written to the device, so the privacy
// promise is kept here rather than by every caller: each event type has a
// list of the fields it may keep (STUDY_FIELDS), and a kept string must be a
// short code word (letters, digits, - _ .), never free text. Anything else —
// what was drawn or written, a name, a link — is dropped before it is
// stored, and again when stored events are read. Each event also carries the
// build that wrote it, so a site updated mid-study never relabels older
// records as the new build.

import { BUILD } from '../build';
import type { EventType } from '../telemetry';

const KEY = 'wonderlab.study';
const MAX = 3000;

/**
 * The fields each event type may keep. A new event type does not compile
 * until it is listed here; a new field is dropped until it is.
 */
export const STUDY_FIELDS: Record<EventType, readonly string[]> = {
  world_ready: ['ms', 'device', 'browser', 'tier', 'buildSha', 'experimentId', 'schemaVersion', 'sceneMode'],
  first_stroke: ['after', 'via'],
  demo_shown: ['n', 'after'],
  stroke_classified: ['kind', 'region', 'length', 'gap', 'turn', 'aspect', 'residual'],
  create: ['what', 'prompted', 'variety', 'family', 'affinity', 'honmei', 'speed', 'bend', 'pointer'],
  emerge: ['what'],
  return: ['awayMin', 'what'],
  replay: ['born', 'honmei', 'received'],
  gift_sent: ['how', 'seal', 'chars'],
  gift_shown: ['seal'],
  gift_accepted: [],
  gift_released: [],
  fish_released: [],
  fish_kept: ['received'],
  gift_failed: ['reason'],
  touch: ['object'],
  text_submit: ['source', 'rule', 'prompted', 'fish', 'fishAnswered'],
  hint_shown: ['hint'],
  hint_followed: ['hint', 'after'],
  undo: ['kind', 'after'],
  restart: ['fish'],
  save: ['kind', 'how', 'format', 'titled'],
  tier_change: ['tier'],
  phase_change: ['phase'],
  record_start: [],
  record_complete: ['seconds', 'format'],
};

/** A code word such as `fish`, `poc-r1` or `3f2a9c1b-dirty`: no spaces, no slashes, no CJK. */
const CODE = /^[A-Za-z0-9_.-]{0,40}$/;

type Value = string | number | boolean;

export interface StoredEvent {
  /** ms since the epoch, so events from different visits line up. */
  t: number;
  type: string;
  /** The build that recorded this event (build.ts). */
  sha: string;
  exp: string;
  schema: number;
  [field: string]: Value;
}

function keepValue(v: unknown): v is Value {
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' && CODE.test(v);
}

/** Only the listed fields, only safe values. An unknown event type keeps nothing and is not stored. */
export function keepFields(type: string, fields: Record<string, unknown>): Record<string, Value> | null {
  const allowed = (STUDY_FIELDS as Record<string, readonly string[] | undefined>)[type];
  if (!allowed) return null;
  const out: Record<string, Value> = {};
  for (const name of allowed) {
    const v = fields[name];
    if (keepValue(v)) out[name] = v;
  }
  return out;
}

function clean(raw: unknown): StoredEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.t !== 'number' || typeof e.type !== 'string') return null;
  const kept = keepFields(e.type, e);
  if (!kept) return null;
  return {
    t: e.t,
    type: e.type,
    // Records from before build stamping cannot be attributed: say so rather than guess.
    sha: typeof e.sha === 'string' && CODE.test(e.sha) && e.sha ? e.sha : 'unknown',
    exp: typeof e.exp === 'string' && CODE.test(e.exp) && e.exp ? e.exp : 'unknown',
    schema: typeof e.schema === 'number' ? e.schema : 0,
    ...kept,
  };
}

/** Events not yet written: writing the whole list on every event would stall drawing on a phone. */
let pending: StoredEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 2000;

function readStored(): StoredEvent[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.map(clean).filter((e): e is StoredEvent => e !== null) : [];
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

/** Keep one event, stamped with this build. Fields outside STUDY_FIELDS are dropped here. */
export function storeEvent(type: string, fields: Record<string, unknown> = {}, t = Date.now()): void {
  const e = clean({ ...fields, t, type, sha: BUILD.sha, exp: BUILD.experiment, schema: BUILD.schema });
  if (!e) return;
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
