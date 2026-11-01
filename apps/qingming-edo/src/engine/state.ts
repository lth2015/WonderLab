import type { Condition, Effect, Familiarity, JournalEntry, QuestState, SaveData } from '../contract';
import { SCHEMA_VERSION, WORLD_ID } from '../contract';

/** Spec §11: 初期所持金60文 (調整値, not a historical figure). */
export const STARTING_MON = 60;
export const SAVE_VERSION = 1;

export function newSave(now = new Date()): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    worldId: WORLD_ID,
    saveVersion: SAVE_VERSION,
    updatedAt: now.toISOString(),
    progress: { quests: {}, flags: [], familiarity: {} },
    wallet: { currencyId: 'mon', balanceMinor: STARTING_MON, grantedRewardIds: [] },
    journal: { pages: [] },
    settings: { reduceMotion: false, textScale: 1, timeChoice: 'auto' },
  };
}

export function questState(s: SaveData, quest: string): QuestState {
  return s.progress.quests[quest] ?? 'undiscovered';
}

export function hasFlag(s: SaveData, flag: string): boolean {
  return s.progress.flags.includes(flag);
}

/** The only operators a condition may use. Unknown shapes are false, never evaluated. */
export function test(s: SaveData, c: Condition | undefined): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => test(s, x));
  if ('any' in c) return c.any.some((x) => test(s, x));
  if ('not' in c) return !test(s, c.not);
  if ('flag' in c) return hasFlag(s, c.flag);
  if ('quest' in c) {
    const st = questState(s, c.quest);
    return Array.isArray(c.is) ? c.is.includes(st) : st === c.is;
  }
  if ('pagesAtLeast' in c) return s.journal.pages.length >= c.pagesAtLeast;
  return false;
}

const ORDER: QuestState[] = ['undiscovered', 'discovered', 'active', 'ready', 'complete'];

/**
 * Applies effects and returns a new save; the input is untouched.
 * - A reward id pays once, whatever replays or double taps happen (spec §11).
 * - A quest never moves backwards, so a stale dialogue cannot undo progress.
 */
export function apply(s: SaveData, effects: Effect[], now = new Date()): SaveData {
  if (effects.length === 0) return s;
  const next: SaveData = structuredClone(s);
  for (const e of effects) {
    switch (e.type) {
      case 'setFlag':
        if (!next.progress.flags.includes(e.flag)) next.progress.flags.push(e.flag);
        break;
      case 'questState': {
        const cur = questState(next, e.quest);
        if (ORDER.indexOf(e.state) > ORDER.indexOf(cur)) next.progress.quests[e.quest] = e.state;
        break;
      }
      case 'grant':
        if (!Number.isInteger(e.amountMinor) || e.amountMinor < 0) throw new Error(`bad reward amount: ${e.rewardId}`);
        if (!next.wallet.grantedRewardIds.includes(e.rewardId)) {
          next.wallet.grantedRewardIds.push(e.rewardId);
          next.wallet.balanceMinor += e.amountMinor;
        }
        break;
      case 'familiarity': {
        const f = (next.progress.familiarity[e.characterId] ??= { level: 0, events: [] });
        // Moved by particular events, never by repetition (spec §11).
        if (!f.events.includes(e.eventId)) {
          f.events.push(e.eventId);
          f.level = Math.min(2, f.level + 1) as Familiarity;
        }
        break;
      }
    }
  }
  next.updatedAt = now.toISOString();
  return next;
}

/** One page per page id; making it again keeps the first. */
export function addPage(s: SaveData, entry: JournalEntry): SaveData {
  if (s.journal.pages.some((p) => p.pageId === entry.pageId)) return s;
  const next = structuredClone(s);
  next.journal.pages.push(entry);
  next.updatedAt = entry.madeAt;
  return next;
}

/**
 * 回想 (spec §9: 後の回想で別の頁を補える). Replaying a finished story never
 * changes money, flags or quests. A page it reaches is kept only when it shows
 * something not yet in the journal: the other ending, or another composition,
 * saved once as `<pageId>-b`. Seeing the same thing again adds nothing.
 */
export function addRecallPage(s: SaveData, pageId: string, compositionId: string, titleStyle = 'plain', now = new Date()): SaveData {
  const pages = s.journal.pages;
  const first = pages.find((p) => p.pageId === pageId);
  if (!first) return s; // recall is only offered after the story is done
  const alt = `${pageId}-b`;
  if (first.compositionId === compositionId || pages.some((p) => p.pageId === alt)) return s;
  return addPage(s, { pageId: alt, compositionId, titleStyle, madeAt: now.toISOString() });
}
