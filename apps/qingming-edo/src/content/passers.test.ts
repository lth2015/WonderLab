import { describe, expect, it } from 'vitest';
import { hasFace } from '../ui/Face';
import type { SaveData } from '../contract';
import { apply, newSave } from '../engine/state';
import { LOST } from './lost';
import { GLIMPSE_Q, PASSERS, favorNode, glimpseNode } from './passers';
import { NODES } from './script';
import { HOTSPOTS } from './world';

describe('通りすがりの人と話す', () => {
  it('each talking passer-by walks the street, has a portrait and three things to ask about their work', () => {
    expect(Object.keys(PASSERS)).toHaveLength(9);
    for (const [id, p] of Object.entries(PASSERS)) {
      const h = HOTSPOTS.find((x) => x.targetId === id);
      expect(h?.walker, id).toBeTruthy();
      expect(hasFace(id), id).toBe(true);
      expect(p.topics).toHaveLength(3);
      for (const t of p.topics) expect(t.a.length).toBeGreaterThan(0);
    }
    // ご隠居 walks too, but is a person of the stories: he keeps his one word
    expect(PASSERS['pass-elder']).toBeUndefined();
  });

  it('the talk opens with them stopping, comes back to the questions after each answer, and ends with their word', () => {
    for (const id of Object.keys(PASSERS)) {
      const open = NODES[`pass.${id}`];
      expect(open.lines[0].by).toBe('narration');
      // three about their work, lost things, 宗吉's riddle (only while one is open), goodbye
      expect(open.choices).toHaveLength(6);
      expect(open.choices!.filter((c) => c.when)).toHaveLength(1);
      for (let i = 0; i < 3; i++) expect(NODES[`pass.${id}.${i}`].next).toBe(PASSERS[id].favor?.after === i ? `pass.${id}.favor` : `pass.${id}.more`);
      expect(NODES[`pass.${id}.more`].choices).toEqual(open.choices);
      expect(NODES[`pass.${id}.bye`].lines[0].by).toBe(id);
    }
  });
});

describe('通りすがりの人は覚えている', () => {
  it('the first talk is remembered; met again they greet the player as someone they know', () => {
    for (const [id, p] of Object.entries(PASSERS)) {
      expect(NODES[`pass.${id}`].effects).toEqual([{ type: 'setFlag', flag: `talked_${id}` }]);
      expect(NODES[`pass.${id}.again`].lines[1].text).toBe(p.again);
      expect(NODES[`pass.${id}.again`].choices).toEqual(NODES[`pass.${id}`].choices);
    }
  });
});

describe('通りすがりの人に落とし物のことを聞く', () => {
  const done = (s: SaveData) => apply(s, [{ type: 'questState', quest: 'kaze', state: 'complete' }]);
  const found = (s: SaveData, ids: string[]) => apply(s, ids.map((id) => ({ type: 'setFlag', flag: `lost_found_${id}` }) as const));

  it('each passer can be asked; the answer comes back to the questions', () => {
    for (const id of Object.keys(PASSERS)) {
      expect(NODES[`pass.${id}`].choices!.find((c) => c.label === GLIMPSE_Q)?.next).toBe(`pass.${id}.seen`);
      expect(NODES[`pass.${id}.seen.none`].next).toBe(`pass.${id}.more`);
      for (const t of LOST) expect(NODES[`pass.${id}.seen.${t.id}`].lines[1].text).toContain(t.place);
    }
  });

  it('before the town opens, or once all is picked up, nothing has been seen', () => {
    const s = newSave();
    expect(glimpseNode(s, 'pass-monk')).toBe('pass.pass-monk.seen.none');
    expect(glimpseNode(found(done(s), LOST.map((t) => t.id)), 'pass-monk')).toBe('pass.pass-monk.seen.none');
  });

  it('they tell of things still lying, different passers of different things, never of one picked up', () => {
    const s = done(newSave());
    const told = new Set(Object.keys(PASSERS).map((id) => glimpseNode(s, id).split('.').pop()));
    expect(told.size).toBe(LOST.length);
    const left = found(s, LOST.slice(1).map((t) => t.id));
    for (const id of Object.keys(PASSERS)) expect(glimpseNode(left, id)).toBe(`pass.${id}.seen.${LOST[0].id}`);
  });
});

describe('路人のちょっとした頼み', () => {
  it('once the player knows who can help, the ask follows its answer; pointed there, that person mentions it once', async () => {
    const { questById } = await import('./world');
    const { entryFor } = await import('../engine/story');
    const done = (s: SaveData, ...qs: string[]) => apply(s, qs.flatMap((q) => questById.get(q)!.completionEffects));
    const favors = Object.entries(PASSERS).filter(([, p]) => p.favor);
    expect(favors).toHaveLength(9);
    for (const [id, p] of favors) {
      const f = p.favor!;
      expect(NODES[`pass.${id}.${f.after}`].next).toBe(`pass.${id}.favor`);
      // not yet knowing them: straight back to the questions
      expect(favorNode(done(newSave(), 'kaze'), id)).toBe(f.needs === 'kaze' ? `pass.${id}.favor.ask` : `pass.${id}.more`);
      let s: SaveData = { ...done(newSave(), 'kaze', f.needs), settings: { ...newSave().settings, timeChoice: 'noon' } };
      expect(favorNode(s, id)).toBe(`pass.${id}.favor.ask`);
      const ask = NODES[`pass.${id}.favor.ask`];
      expect(ask.choices![0].next).toBe(`pass.${id}.favor.yes`);
      expect(ask.choices![1].next).toBe(`pass.${id}.more`);
      expect(entryFor(f.who, s)).not.toBe(`favor.${id}`);
      s = apply(s, NODES[`pass.${id}.favor.yes`].effects!);
      expect(favorNode(s, id)).toBe(`pass.${id}.more`);
      // other words of theirs may come first (a lost thing, a rumor): say those, then this one
      for (let k = 0; k < 6 && entryFor(f.who, s) !== `favor.${id}` && NODES[entryFor(f.who, s)!]?.effects; k++) s = apply(s, NODES[entryFor(f.who, s)!].effects!);
      expect(entryFor(f.who, s), id).toBe(`favor.${id}`);
      expect(NODES[`favor.${id}`].lines[0].by).toBe(f.who);
      s = apply(s, NODES[`favor.${id}`].effects!);
      expect(entryFor(f.who, s), `${id} once`).not.toBe(`favor.${id}`);
    }
  });
});
