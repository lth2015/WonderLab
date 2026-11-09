import { describe, expect, it } from 'vitest';
import { initialState, parseSave, reduceGame, type Action } from './game';
import { CHARACTERS } from './content';
import { ROLL_MAX, ROLL_MIN } from './layout';
import { LOST, carriedThings, heardThings, lostMapHints, lostOnVisit, lyingThings } from './lost';
import { mapMarks } from './townMap';

const run = (actions: Action[], state = initialState()) => actions.reduce(reduceGame, state);
const paper: Action[] = [{ type: 'PRESS_PAPER' }, { type: 'SKETCH', view: 'hands' }];

describe('汴河拾遗', () => {
  it('five things, each with an owner of the town, a place on the roll and their words', () => {
    expect(LOST).toHaveLength(5);
    expect(new Set(LOST.map((t) => t.owner)).size).toBe(5);
    for (const t of LOST) {
      expect(CHARACTERS[t.owner]).toBeDefined();
      expect(t.x).toBeGreaterThan(ROLL_MIN);
      expect(t.x).toBeLessThan(ROLL_MAX);
      for (const line of [t.hint, t.find, t.back]) expect(line).toMatch(/[。！…—]$/);
    }
    // 陈生 has his own lost thing (谁的香囊): no second one for him
    expect(LOST.some((t) => t.owner === 'chen')).toBe(false);
  });

  it('nothing lies in the painting before the first story', () => {
    expect(lyingThings(initialState())).toEqual([]);
    expect(lyingThings(run(paper))).toHaveLength(5);
    expect(run([{ type: 'LOST_FIND', id: 'brush' }]).progress.lost.found).toEqual([]);
  });

  it('the owner thanks first, speaks of the loss on the next visit, once; then 附近 and the map know it', () => {
    let s = run(paper);
    expect(lostOnVisit(s, 'liu')?.kind).toBe('seen');
    s = run([{ type: 'LOST_SEEN', who: 'liu' }], s);
    expect(lostOnVisit(s, 'liu')?.kind).toBe('hint');
    expect(heardThings(s)).toEqual([]);
    expect(mapMarks(s, lostMapHints(s)).some((m) => m.kind === 'lost')).toBe(false);
    s = run([{ type: 'LOST_HEAR', id: 'brush' }], s);
    expect(lostOnVisit(s, 'liu')).toBeNull();
    expect(heardThings(s).map((t) => t.id)).toEqual(['brush']);
    expect(mapMarks(s, lostMapHints(s)).filter((m) => m.kind === 'lost')).toHaveLength(1);
    // someone whose story is not done says nothing of theirs yet
    expect(lostOnVisit(s, 'zhou')).toBeNull();
  });

  it('found (with or without the word), it is carried, given back once, and pays nothing', () => {
    let s = run([...paper, { type: 'LOST_FIND', id: 'seal' }]);
    const money = s.wallet;
    expect(carriedThings(s).map((t) => t.id)).toEqual(['seal']);
    expect(lyingThings(s).some((t) => t.id === 'seal')).toBe(false);
    expect(lostOnVisit(s, 'shen')?.kind).toBe('back');
    s = run([{ type: 'LOST_RETURN', id: 'seal' }, { type: 'LOST_RETURN', id: 'seal' }], s);
    expect(s.progress.lost.returned).toEqual(['seal']);
    expect(carriedThings(s)).toEqual([]);
    expect(s.wallet).toBe(money);
    expect(lostOnVisit(s, 'shen')).toBeNull();
    // what was never found cannot be given back
    expect(run([{ type: 'LOST_RETURN', id: 'comb' }], s).progress.lost.returned).toEqual(['seal']);
  });

  it('old saves gain an empty ledger; a damaged ledger is refused', () => {
    const old = JSON.parse(JSON.stringify(run(paper)));
    delete old.progress.lost;
    const s = parseSave(JSON.stringify(old));
    expect(s.progress.lost).toEqual({ seen: [], heard: [], found: [], returned: [] });
    expect(s.claimed).toEqual(['paper']);
    const bad = { ...old, progress: { ...old.progress, lost: { seen: [], heard: [], found: [], returned: ['comb'] } } };
    expect(() => parseSave(JSON.stringify(bad))).toThrow();
    const unknown = { ...old, progress: { ...old.progress, lost: { seen: [], heard: ['jade'], found: [], returned: [] } } };
    expect(() => parseSave(JSON.stringify(unknown))).toThrow();
  });
});
