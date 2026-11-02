import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createStudy } from '../engine/study';
import { COMMENT, COMMENT_BY_COMPOSITION, PLACE, RECALL_NOTE } from './pageText';
import { ENTRIES, NODES, RECALL_START } from './script';
import { AMBIENT, AMBIENT_LABEL, AMBIENT_REACTION, characterById, HOTSPOTS, PAGE_TITLES, PAGES, QUESTS, ROLES, SCENE, SCENE_W, SUBJECTS, validJournalEntry } from './world';
import SIZES from '../assets/art/sizes.json';

// 新しい場面・小話の登録 (roadmap #158 item 3): what adding a place or a story has to
// touch, checked in one place. docs/painted-worlds/qingming-edo/内容追加チェックリスト.md
// lists the same steps for people.

const storyPages = Object.values(NODES).flatMap((n) => (n.page ? [n.page] : []));

describe('a story is registered everywhere it shows', () => {
  for (const q of QUESTS) {
    it(`${q.id}: recall start and note, a page with a title, and the playtest log knows it`, () => {
      expect(NODES[RECALL_START[q.id]], 'RECALL_START').toBeDefined();
      expect(RECALL_NOTE[q.id], 'content/pageText.ts RECALL_NOTE').toBeTruthy();
      const pages = PAGES.filter((p) => p.triggerId === q.id);
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) expect(PAGE_TITLES[p.id], `PAGE_TITLES ${p.id}`).toBeTruthy();
      const log = createStudy('test', 'b');
      expect(log.emit('story_started', { story_id: q.id }), 'engine/study.ts accepts it').toBe(true);
    });
  }
});

describe('every page a story can leave can be drawn and read', () => {
  it('passes validJournalEntry, and has its place line and 宗吉 word', () => {
    expect(storyPages.length).toBeGreaterThan(0);
    for (const { pageId, compositionId } of storyPages) {
      const c = compositionId.replace('{tod}', 'morning');
      expect(validJournalEntry(pageId, c), `${pageId} ${c}`).toBe(true);
      if (c.startsWith('sketch-') || c.startsWith('kaze-')) continue; // their words come from SKETCHES / the subject
      expect(PLACE[c], `PLACE ${c}`).toBeTruthy();
      expect(COMMENT_BY_COMPOSITION[c], `COMMENT_BY_COMPOSITION ${c}`).toBeTruthy();
    }
    for (const s of SUBJECTS) expect(COMMENT[s.id]).toBeTruthy();
  });
});

describe('every person and thing on the street is complete', () => {
  it('people have a role, opening rules and, if they stand on the street, a spot', () => {
    for (const c of characterById.values()) {
      expect(ROLES[c.id], `ROLES ${c.id}`).toBeTruthy();
      expect(ENTRIES[c.id]?.length, `ENTRIES ${c.id}`).toBeGreaterThan(0);
    }
  });
  it('ambient things have their words and their label', () => {
    for (const h of HOTSPOTS.filter((x) => x.kind === 'ambient')) {
      expect(AMBIENT[h.targetId], `AMBIENT ${h.targetId}`).toBeTruthy();
      expect(AMBIENT_LABEL[h.targetId], `AMBIENT_LABEL ${h.targetId}`).toBeTruthy();
      expect(AMBIENT_REACTION[h.targetId], `AMBIENT_REACTION ${h.targetId} (what a tap visibly does)`).toBeTruthy();
    }
  });
  it('every tap area is inside the scene', () => {
    for (const h of HOTSPOTS) {
      expect(h.hitArea.x).toBeGreaterThanOrEqual(0);
      expect(h.hitArea.x + h.hitArea.w, h.id).toBeLessThanOrEqual(SCENE_W);
    }
  });
});

describe('the painting covers the scene', () => {
  it('one section of art per 1000 units, and every sprite has its image', () => {
    expect(SCENE.sections.length * 1000).toBe(SCENE_W);
    for (const s of SCENE.sections) expect(existsSync(new URL(`../assets/art/street-${s.id.slice(1)}.webp`, import.meta.url)), s.id).toBe(true);
    for (const id of Object.keys(SIZES)) expect(existsSync(new URL(`../assets/art/${id}.webp`, import.meta.url)), id).toBe(true);
  });
});
