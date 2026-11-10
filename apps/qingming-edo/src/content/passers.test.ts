import { describe, expect, it } from 'vitest';
import { hasFace } from '../ui/Face';
import { PASSERS } from './passers';
import { NODES } from './script';
import { HOTSPOTS } from './world';

describe('通りすがりの人と話す', () => {
  it('each talking passer-by walks the street, has a portrait and three things to ask about their work', () => {
    expect(Object.keys(PASSERS)).toHaveLength(6);
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
      expect(open.choices).toHaveLength(4);
      for (let i = 0; i < 3; i++) expect(NODES[`pass.${id}.${i}`].next).toBe(`pass.${id}.more`);
      expect(NODES[`pass.${id}.more`].choices).toEqual(open.choices);
      expect(NODES[`pass.${id}.bye`].lines[0].by).toBe(id);
    }
  });
});
