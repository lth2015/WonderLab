import { describe, expect, it, vi } from 'vitest';

vi.mock('./chapters', async (orig) => ({ ...(await orig<typeof import('./chapters')>()), questOpen: () => true }));
import { LOST } from '../content/lost';
import { ENTRIES, NODES, ON_CLOSE } from '../content/script';
import { HOTSPOTS, SCENE_W } from '../content/world';
import type { SaveData } from '../contract';
import { apply, hasFlag, newSave } from './state';
import { entryFor, visibleSpots } from './story';
import { mapMarks, MAP_ROWS, MAP_ROW_UNITS, personMarks, toMap } from './townMap';
import { questById } from '../content/world';

const open = (s: SaveData, id: string) => (NODES[id].effects ? apply(s, NODES[id].effects!) : s);
const done = (s: SaveData, ...quests: string[]) => apply(s, quests.flatMap((q) => questById.get(q)!.completionEffects));
const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);

describe('探し物', () => {
  it('every thing has its spot, its owner rules and its nodes', () => {
    for (const t of LOST) {
      expect(HOTSPOTS.find((h) => h.id === `h-lost-${t.id}`)?.targetId).toBe(`lost_${t.id}`);
      expect(ENTRIES[t.owner].some((r) => r.node === `lost.${t.id}.hint`)).toBe(true);
      expect(ENTRIES[t.owner].some((r) => r.node === `lost.${t.id}.back`)).toBe(true);
      expect(ENTRIES[`lost_${t.id}`][0].node).toBe(`lost.${t.id}.find`);
      expect(NODES[`lost.${t.id}.find`].brief).toBe(true);
      expect(t.at.x).toBeGreaterThan(0);
      expect(t.at.x).toBeLessThan(SCENE_W);
    }
  });

  it('nothing lies in the street before 風のいたずら is done', () => {
    const s = newSave();
    for (const t of LOST) expect(spot(s, `h-lost-${t.id}`)).toBe(false);
    const k = done(s, 'kaze');
    for (const t of LOST) expect(spot(k, `h-lost-${t.id}`)).toBe(true);
  });

  it('the owner mentions the loss only after their own thanks, and the map marks the area', () => {
    let s = done(newSave(), 'kaze');
    expect(entryFor('seita', s)).toBe('seita.done');
    expect(mapMarks(s).some((m) => m.kind === 'lost')).toBe(false);
    s = apply(s, ON_CLOSE['seita.done']);
    expect(entryFor('seita', s)).toBe('lost.sensu.hint');
    s = open(s, 'lost.sensu.hint');
    expect(entryFor('seita', s)).toBe('seita.again');
    const m = mapMarks(s).filter((x) => x.kind === 'lost');
    expect(m).toHaveLength(1);
    expect(m[0].label).toContain('橋のたもと');
  });

  it('found (with or without the word), it is given back once, and the ？ goes', () => {
    let s = apply(done(newSave(), 'kaze'), ON_CLOSE['seita.done']);
    s = open(s, 'lost.sensu.hint');
    s = open(s, entryFor('lost_sensu', s)!);
    expect(hasFlag(s, 'lost_found_sensu')).toBe(true);
    expect(spot(s, 'h-lost-sensu')).toBe(false);
    expect(mapMarks(s).some((x) => x.kind === 'lost')).toBe(false);
    expect(entryFor('seita', s)).toBe('lost.sensu.back');
    s = open(s, 'lost.sensu.back');
    expect(entryFor('seita', s)).toBe('seita.again');
    // found before any word: the owner takes it back and never mentions the loss
    let q = done(newSave(), 'kaze');
    q = open(q, 'lost.sensu.find');
    expect(entryFor('seita', q)).toBe('lost.sensu.back');
    q = apply(open(q, 'lost.sensu.back'), ON_CLOSE['seita.done']);
    expect(entryFor('seita', q)).not.toBe('lost.sensu.hint');
  });

  it('惣吉 has a word once all six are back', () => {
    let s = done(newSave(), 'kaze', 'dougu', 'tenugui', 'inkyo', 'neko', 'kashi');
    for (const t of LOST.slice(1)) s = open(open(s, `lost.${t.id}.find`), `lost.${t.id}.back`);
    expect(entryFor('sokichi', s)).not.toBe('lost.allback');
    s = open(open(s, `lost.${LOST[0].id}.find`), `lost.${LOST[0].id}.back`);
    expect(entryFor('sokichi', s)).toBe('lost.allback');
    expect(entryFor('sokichi', open(s, 'lost.allback'))).not.toBe('lost.allback');
  });
});

describe('町の絵図', () => {
  it('folds the roll into four rows, the bridge end on top', () => {
    expect(toMap(13000, 500)).toEqual({ row: 0, px: 200, py: 100 });
    expect(toMap(0, 0).row).toBe(3);
    expect(toMap(MAP_ROWS[1] + 10, 0).row).toBe(1);
    expect(MAP_ROWS[0] + MAP_ROW_UNITS).toBeGreaterThanOrEqual(SCENE_W);
  });

  it('marks waiting requests but not people merely not yet greeted', () => {
    const s = done(newSave(), 'kaze');
    const asks = mapMarks(s).filter((m) => m.kind === 'ask');
    expect(asks.length).toBeGreaterThan(0);
    expect(new Set(asks.map((m) => `${m.x},${m.y}`)).size).toBe(asks.length);
  });

  it('shows the people met where they are now, with their portrait', () => {
    expect(personMarks(newSave()).map((m) => m.who)).toEqual(['sokichi']);
    const s = apply(done(newSave(), 'kaze'), [{ type: 'setFlag', flag: 'met_seita' }]);
    const seita = personMarks(s).find((m) => m.who === 'seita')!;
    expect(seita.label).toContain('清太');
    expect(seita.x).toBe(HOTSPOTS.find((h) => h.id === 'h-seita')!.anchor.x);
  });
});
