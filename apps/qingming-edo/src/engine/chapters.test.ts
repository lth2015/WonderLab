import { describe, expect, it } from 'vitest';
import { CHAPTERS, QUESTS, questById } from '../content/world';
import type { SaveData } from '../contract';
import { openChapters, questOpen } from './chapters';
import { apply, newSave } from './state';
import { entryFor, nearbyAll, visibleSpots } from './story';

const done = (s: SaveData, ...qs: string[]) => apply(s, qs.flatMap((q) => questById.get(q)!.completionEffects));
const at = (s: SaveData, t: 'morning' | 'noon' | 'evening'): SaveData => ({ ...s, settings: { ...s.settings, timeChoice: t } });
const OFFER_IDS = new Set(QUESTS.map((q) => q.id));
/** Invitations that can be taken up now (not waiting for another time or the rain). */
const offersNow = (s: SaveData) => nearbyAll(s).filter((n) => OFFER_IDS.has(n.id) && !n.later).map((n) => n.id);

describe('章: stories open a batch at a time', () => {
  it('every story is in exactly one chapter, 風のいたずら first and 橋のたもと last', () => {
    const all = CHAPTERS.flat();
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(QUESTS.map((q) => q.id).sort());
    expect(CHAPTERS[0]).toEqual(['kaze']);
    expect(CHAPTERS[CHAPTERS.length - 1]).toEqual(['hashi']);
  });

  it('after the first page only the bridge-end street is offered', () => {
    const s = at(done(newSave(), 'kaze'), 'noon');
    expect(openChapters(s)).toBe(2);
    expect(offersNow(s).sort()).toEqual(['dougu', 'fumi', 'tenugui']);
    expect(entryFor('omatsu', s)).toBe('omatsu.first'); // not yet her story
    expect(visibleSpots(s).some((h) => h.id === 'h-fumi')).toBe(true);
  });

  it('two stories of a chapter open the next', () => {
    let s = at(done(newSave(), 'kaze', 'dougu'), 'noon');
    expect(questOpen(s, 'kashi')).toBe(false);
    s = done(s, 'tenugui');
    expect(questOpen(s, 'kashi')).toBe(true);
    expect(entryFor('omatsu', s)).toBe('omatsu.ask');
    expect(questOpen(s, 'inkyo')).toBe(false);
    expect(visibleSpots(s).some((h) => h.id === 'h-inkyo')).toBe(false); // the elder is only a passer-by yet
  });

  it('a story already begun stays open (saves from before chapters)', () => {
    const s = apply(done(newSave(), 'kaze'), [{ type: 'questState', quest: 'kashi', state: 'active' }, { type: 'setFlag', flag: 'kashi_search' }]);
    expect(questOpen(s, 'kashi')).toBe(true);
    expect(entryFor('omatsu', s)).toBe('omatsu.searching');
  });

  it('playing chapter by chapter, at most four invitations wait at any time of day', () => {
    let s = done(newSave(), 'kaze');
    s = apply(s, [{ type: 'setFlag', flag: 'paper_pressed' }, { type: 'setFlag', flag: 'kisuke_seen_done' }]);
    for (const q of CHAPTERS.slice(1).flat()) {
      for (const t of ['morning', 'noon', 'evening'] as const) expect(offersNow(at(s, t)).length, `${q} ${t}: ${offersNow(at(s, t))}`).toBeLessThanOrEqual(4);
      s = done(s, q);
    }
  });
});
