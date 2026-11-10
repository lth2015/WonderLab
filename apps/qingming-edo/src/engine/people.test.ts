import { describe, expect, it } from 'vitest';
import { NAJIMI, PEOPLE, PROFILE } from '../content/people';
import { characterById, questById } from '../content/world';
import { hasFace } from '../ui/Face';
import { acquaintances, personSpots } from './people';
import { apply, newSave } from './state';

const done = (q: string) => questById.get(q)!.completionEffects;

describe('人物帳', () => {
  it('everyone in the book is a person of the town, with a portrait, a profile and a place', () => {
    for (const id of PEOPLE) {
      expect(characterById.get(id), id).toBeDefined();
      expect(hasFace(id), id).toBe(true);
      expect(PROFILE[id]).toMatch(/。$/);
      expect(personSpots(id).length, id).toBeGreaterThan(0);
    }
    expect(NAJIMI).toEqual(['初めて', '顔なじみ', '気の置けない間柄']);
  });

  it('a new player knows only 宗吉; greeting someone puts them in the book as 初めて', () => {
    expect(acquaintances(newSave()).map((p) => p.id)).toEqual(['sokichi']);
    const s = apply(newSave(), [{ type: 'setFlag', flag: 'met_kinji' }]);
    const k = acquaintances(s).find((p) => p.id === 'kinji')!;
    expect(k.level).toBe(0);
    expect(k.shared).toEqual([]);
  });

  it('shared stories deepen なじみ and are named by their titles', () => {
    let s = apply(newSave(), [...done('kaze'), ...done('dougu')]);
    const okon = acquaintances(s).find((p) => p.id === 'okon')!;
    expect(okon.level).toBe(1);
    expect(okon.shared).toEqual(['いつもの道具']);
    s = apply(s, [{ type: 'familiarity', characterId: 'okon', eventId: 'hashi' }]);
    const again = acquaintances(s).find((p) => p.id === 'okon')!;
    expect(again.level).toBe(2);
    expect(again.shared).toEqual(['いつもの道具', '橋のたもと']);
    // the same event twice changes nothing (spec §11: never by repetition)
    expect(acquaintances(apply(s, [{ type: 'familiarity', characterId: 'okon', eventId: 'hashi' }])).find((p) => p.id === 'okon')!.level).toBe(2);
  });

  it('会いに行く points at where the person is now', () => {
    const s = apply(newSave(), [...done('kaze'), { type: 'setFlag', flag: 'met_seita' }]);
    expect(acquaintances(s).find((p) => p.id === 'seita')!.spotId).toBe('h-seita');
    expect(acquaintances(s).find((p) => p.id === 'sokichi')!.spotId).toBe('h-sokichi');
  });
});

describe('人物帳とその後', () => {
  it('what was seen from the bench and the things given back go into the person’s page', async () => {
    const { buyTea } = await import('./shop');
    let s = apply(newSave(), [...done('kaze'), ...done('dougu'), { type: 'setFlag', flag: 'met_kinji' }]);
    s = buyTea(s)!.save; // 清太's papers
    s = buyTea(s)!.save; // 金次 calls for tea
    const kinji = acquaintances(s).find((p) => p.id === 'kinji')!;
    expect(kinji.lately).toHaveLength(1);
    expect(kinji.lately[0]).toMatch(/天秤棒.*「喜助さん、一杯！/);
    expect(acquaintances(s).find((p) => p.id === 'seita')!.lately[0]).toMatch(/文鎮/);
    s = apply(s, [{ type: 'setFlag', flag: 'lost_back_netsuke' }]);
    expect(acquaintances(s).find((p) => p.id === 'kinji')!.returned).toEqual(['亀の根付']);
  });
});
