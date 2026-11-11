import { describe, expect, it } from 'vitest';
import type { SaveData } from '../contract';
import { apply, hasFlag, newSave } from '../engine/state';
import { entryFor } from '../engine/story';
import { LOST } from './lost';
import { NAZO, NAZO_HINTS, NAZO_OPEN, nazoAt, nazoCarried, nazoFlag, nazoHintNode, nazoOpen } from './nazo';
import { PASSERS } from './passers';
import { test } from '../engine/state';
import { NODES } from './script';
import { HOTSPOTS, questById } from './world';

const allBack = (): SaveData =>
  apply(newSave(), [...questById.get('kaze')!.completionEffects, ...LOST.map((t) => ({ type: 'setFlag' as const, flag: `lost_back_${t.id}` }))]);
const read = (s: SaveData, node: string) => apply(s, NODES[node].effects ?? []);

describe('宗吉の謎かけ', () => {
  it('each riddle is answered by a thing always in the street', () => {
    expect(NAZO).toHaveLength(3);
    for (const n of NAZO) for (const spot of n.spots) {
      const h = HOTSPOTS.find((x) => x.targetId === spot);
      expect(h?.kind, spot).toBe('ambient');
      expect(h?.visibleWhen, spot).toBeUndefined();
    }
  });

  it('starts right after the last lost thing is back, and nothing is found before a riddle is told', () => {
    let s = allBack();
    expect(nazoAt(s, 'pond')).toBeNull();
    expect(entryFor('sokichi', s)).toBe('lost.allback');
    expect(NODES['lost.allback'].next).toBe('nazo.start');
    s = read(s, 'lost.allback');
    // a save that read the lost things' word before the hunt existed still gets it
    expect(entryFor('sokichi', s)).toBe('nazo.start');
    s = read(s, 'nazo.start');
    expect(entryFor('sokichi', s)).not.toBe('nazo.start');
    expect(nazoOpen(s)).toBe(0);
  });

  it('one riddle at a time: the right thing finds the sketch, 宗吉 sees it and gives the next', () => {
    let s = read(read(allBack(), 'lost.allback'), 'nazo.start');
    NAZO.forEach((n, i) => {
      // the next riddle's answer finds nothing yet
      if (NAZO[i + 1]) expect(nazoAt(s, NAZO[i + 1].spots[0])).toBeNull();
      expect(nazoCarried(s)[0]).toContain(n.riddle);
      expect(nazoAt(s, n.spots[0])).toBe(`nazo.${n.id}.find`);
      s = read(s, `nazo.${n.id}.find`);
      expect(nazoAt(s, n.spots[0])).toBeNull();
      expect(nazoCarried(s)[0]).toContain(n.place);
      expect(entryFor('sokichi', s)).toBe(`nazo.${n.id}.show`);
      s = read(s, `nazo.${n.id}.show`);
      expect(entryFor('sokichi', s)).not.toBe(`nazo.${n.id}.show`);
    });
    expect(nazoOpen(s)).toBe(-1);
    expect(nazoCarried(s)).toEqual(['宗吉の若いころの下絵（三枚）']);
    expect(hasFlag(s, nazoFlag('shown', 2))).toBe(true);
  });

  it('the last riddle accepts either banner', () => {
    let s = read(read(allBack(), 'lost.allback'), 'nazo.start');
    for (const n of NAZO.slice(0, 2)) s = read(read(s, `nazo.${n.id}.find`), `nazo.${n.id}.show`);
    expect(nazoAt(s, 'banner')).toBe('nazo.nobori.find');
    expect(nazoAt(s, 'cloth-banner')).toBe('nazo.nobori.find');
  });

  it('passers-by can be asked about the open riddle: each riddle has someone who knows, from their work', () => {
    expect(Object.keys(NAZO_HINTS).sort()).toEqual(Object.keys(PASSERS).sort());
    for (const n of NAZO) expect(Object.values(NAZO_HINTS).filter((h) => h.nazo === n.id).length, n.id).toBeGreaterThanOrEqual(2);
    let s = read(allBack(), 'lost.allback');
    expect(test(s, NAZO_OPEN)).toBe(false);
    s = read(s, 'nazo.start');
    NAZO.forEach((n, i) => {
      expect(test(s, NAZO_OPEN)).toBe(true);
      for (const [id, h] of Object.entries(NAZO_HINTS)) {
        expect(nazoHintNode(s, id), id).toBe(h.nazo === n.id ? `pass.${id}.nazo.hint` : `pass.${id}.nazo.dunno`);
        expect(NODES[nazoHintNode(s, id)].next).toBe(`pass.${id}.more`);
      }
      s = read(s, `nazo.${n.id}.find`);
      expect(test(s, NAZO_OPEN), `found ${i}`).toBe(false);
      s = read(s, `nazo.${n.id}.show`);
    });
    expect(test(s, NAZO_OPEN)).toBe(false);
  });
});
