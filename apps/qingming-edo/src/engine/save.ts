import type { SaveData } from '../contract';
import { SCHEMA_VERSION, WORLD_ID } from '../contract';
import { SAVE_VERSION, newSave } from './state';

// Storage stays inside this work's namespace (spec §16): ww:qingming-edo:*.
// Nothing here reads, writes or clears another work's keys.
export const KEY_PREFIX = `ww:${WORLD_ID}:`;
export const SAVE_KEY = `${KEY_PREFIX}save`;

export type LoadResult =
  | { kind: 'fresh'; save: SaveData }
  | { kind: 'loaded'; save: SaveData }
  /** Unreadable: the original was kept under backupKey and play starts fresh. */
  | { kind: 'corrupt'; save: SaveData; backupKey: string }
  /** Written by a newer version: kept untouched, and this session does not write over it. */
  | { kind: 'newer'; save: SaveData };

export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const QUEST_STATES = new Set(['undiscovered', 'discovered', 'active', 'ready', 'complete']);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Checks a parsed object is a save this version can use, and brings older
 * versions up to date. Throws with a reason when it cannot.
 */
export function migrate(raw: unknown): SaveData | 'newer' {
  if (!raw || typeof raw !== 'object') throw new Error('not an object');
  const r = raw as Record<string, unknown>;
  if (r.worldId !== WORLD_ID) throw new Error(`another work's save: ${String(r.worldId)}`);
  if (r.schemaVersion !== SCHEMA_VERSION) {
    if (typeof r.schemaVersion === 'number' && r.schemaVersion > SCHEMA_VERSION) return 'newer';
    throw new Error(`unknown schemaVersion ${String(r.schemaVersion)}`);
  }
  if (typeof r.saveVersion !== 'number' || !Number.isInteger(r.saveVersion) || r.saveVersion < 1) throw new Error('bad saveVersion');
  if (r.saveVersion > SAVE_VERSION) return 'newer';
  // saveVersion 1 is the first; later versions add their steps here, in order.

  const base = newSave();
  const p = r.progress as SaveData['progress'] | undefined;
  const w = r.wallet as SaveData['wallet'] | undefined;
  const j = r.journal as SaveData['journal'] | undefined;
  if (!p || typeof p.quests !== 'object' || !isStrArr(p.flags)) throw new Error('bad progress');
  for (const v of Object.values(p.quests)) if (!QUEST_STATES.has(v as string)) throw new Error('bad quest state');
  if (!w || !Number.isInteger(w.balanceMinor) || w.balanceMinor < 0 || !isStrArr(w.grantedRewardIds)) throw new Error('bad wallet');
  if (!j || !Array.isArray(j.pages)) throw new Error('bad journal');
  for (const pg of j.pages) if (typeof pg?.pageId !== 'string' || typeof pg?.compositionId !== 'string') throw new Error('bad page');
  const st = (r.settings ?? {}) as Partial<SaveData['settings']>;
  return {
    ...base,
    saveVersion: SAVE_VERSION,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : base.updatedAt,
    progress: { quests: { ...p.quests }, flags: [...p.flags], familiarity: { ...(p.familiarity ?? {}) } },
    wallet: { currencyId: 'mon', balanceMinor: w.balanceMinor, grantedRewardIds: [...w.grantedRewardIds] },
    journal: { pages: j.pages.map((x) => ({ ...x })) },
    settings: {
      reduceMotion: st.reduceMotion === true,
      textScale: st.textScale === 1.25 || st.textScale === 1.5 ? st.textScale : 1,
      timeChoice: st.timeChoice === 'morning' || st.timeChoice === 'noon' || st.timeChoice === 'evening' ? st.timeChoice : 'auto',
      ...(okLevels(st.sound) ? { sound: { ambient: st.sound.ambient, ui: st.sound.ui, music: st.sound.music } } : {}),
    },
  };
}

function okLevels(l: unknown): l is NonNullable<SaveData['settings']['sound']> {
  const v = l as Record<string, unknown> | null | undefined;
  return !!v && ['ambient', 'ui', 'music'].every((k) => typeof v[k] === 'number' && (v[k] as number) >= 0 && (v[k] as number) <= 1);
}

export function load(store: Store, now = new Date()): LoadResult {
  let text: string | null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    return { kind: 'fresh', save: newSave(now) }; // storage blocked: play in memory
  }
  if (text === null) return { kind: 'fresh', save: newSave(now) };
  try {
    const m = migrate(JSON.parse(text));
    if (m === 'newer') return { kind: 'newer', save: newSave(now) };
    return { kind: 'loaded', save: m };
  } catch {
    const backupKey = `${KEY_PREFIX}save-corrupt-${now.getTime()}`;
    try {
      store.setItem(backupKey, text);
    } catch {
      /* nothing more we can do; the original key is left as it was */
    }
    return { kind: 'corrupt', save: newSave(now), backupKey };
  }
}

export function persist(store: Store, s: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** The file a player can keep (spec §16). */
export function exportText(s: SaveData): string {
  return JSON.stringify(s, null, 2);
}

/** Never throws; on failure the caller keeps the current save. */
export function importText(text: string): { ok: true; save: SaveData } | { ok: false; reason: 'newer' | 'invalid' } {
  try {
    const m = migrate(JSON.parse(text));
    if (m === 'newer') return { ok: false, reason: 'newer' };
    return { ok: true, save: m };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
