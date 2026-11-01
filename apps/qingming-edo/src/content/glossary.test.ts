import { describe, expect, it } from 'vitest';
import { GLOSSARY, splitGlossed } from './glossary';
import { NODES } from './script';
import { FALLBACK } from './talk';

const terms = (t: string) => splitGlossed(t).filter((p) => typeof p !== 'string').map((p) => (p as { term: string }).term);

describe('難語', () => {
  it('marks each term once per line, longest first, and keeps the text whole', () => {
    const line = '番頭さんの文鎮を、番頭さんに返す。天秤棒を担いだ振売り。';
    expect(terms(line)).toEqual(['番頭', '文鎮', '天秤棒', '振売り']);
    expect(splitGlossed(line).map((p) => (typeof p === 'string' ? p : p.term)).join('')).toBe(line);
  });
  it('「文」 only as money after a number', () => {
    expect(terms('十二文を受け取った')).toEqual(['文']);
    expect(terms('文鎮で押さえた')).toEqual(['文鎮']);
    expect(terms('文を書く')).toEqual([]);
  });
  it('every entry is short, has a reading, and appears somewhere in the dialogue', () => {
    const all = Object.values(NODES).flatMap((n) => n.lines.map((l) => l.text)).join('\n') + JSON.stringify(FALLBACK); // dialogue and the scripted talk lines
    for (const g of GLOSSARY) {
      expect(g.reading).toMatch(/^[ぁ-ゖー]+$/);
      expect([...g.note].length).toBeLessThanOrEqual(40);
      expect(all.includes(g.term)).toBe(true);
    }
  });
});
