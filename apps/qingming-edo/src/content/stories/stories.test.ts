import { describe, expect, it } from 'vitest';
import { ENTRIES, NODES } from '../script';
import { CHAPTERS, HOTSPOTS } from '../world';
import { STORIES } from '.';

/** A composition each page can be drawn with: `a-{b|c}` → `a-b`; the dynamic ones by example. */
const example = (pattern: string) => (pattern === 'ugoki-{who}-{x}' ? 'ugoki-parasol-10600' : pattern.replace(/\{([a-z]+)\|[a-z|]+\}/, '$1'));

describe('stories in their own files (content/stories)', () => {
  it('each is complete: chapter, start, pages with pictures, rules to real nodes', () => {
    const ids = STORIES.map((s) => s.quest.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const st of STORIES) {
      const id = st.quest.id;
      expect(CHAPTERS.flat(), id).toContain(id);
      expect(NODES[st.recallStart], `${id} recallStart`).toBeTruthy();
      expect(st.pages.length, id).toBeGreaterThan(0);
      for (const p of st.pages) {
        const c = example(p.compositionId);
        expect(st.titles[p.id], `${id} title ${p.id}`).toBeTruthy();
        expect(st.valid(p.id, c), `${id} valid ${p.id} ${c}`).toBe(true);
        expect(st.view(c), `${id} view ${c}`).not.toBeNull();
      }
      for (const [target, rules] of Object.entries(st.entries)) {
        expect(ENTRIES[target], `${id} → ${target}`).toBeTruthy();
        for (const r of rules) expect(NODES[r.node], `${id} rule → ${r.node}`).toBeTruthy();
      }
      for (const h of st.hotspots ?? []) expect(HOTSPOTS.some((x) => x.id === h.id), h.id).toBe(true);
      for (const n of Object.keys(st.nodes)) expect(NODES[n], `${id} node ${n}`).toBe(st.nodes[n]);
    }
  });

  it("a story's pages and views do not answer for other stories' compositions", () => {
    for (const st of STORIES) for (const other of STORIES) if (other !== st) for (const p of other.pages) expect(st.view(example(p.compositionId)), `${st.quest.id} vs ${p.compositionId}`).toBeNull();
  });
});

describe('every thing on the street has its own name in the lists', () => {
  it('props are named by what they are, and no two things share a name', async () => {
    const { HOTSPOTS: all, spotLabel } = await import('../world');
    const props = all.filter((h) => h.kind === 'prop');
    for (const h of props) expect(spotLabel(h), h.id).not.toBe(h.targetId);
    const names = props.map((h) => spotLabel(h));
    expect(new Set(names).size).toBe(names.length);
  });
});
