import { describe, expect, it } from 'vitest';
import { ABOUT, aboutLine, aboutWhom, KNOWN_BY } from './about';
import { FALLBACK } from './talk';
import { characterById, questById } from './world';
import { hasFace } from '../ui/Face';

describe('人のこと', () => {
  it('everyone who talks can be asked about others, only about people in the town', () => {
    for (const speaker of Object.keys(FALLBACK)) {
      const subjects = Object.keys(ABOUT[speaker] ?? {});
      expect(subjects.length, speaker).toBeGreaterThanOrEqual(5);
      for (const s of subjects) {
        expect(s).not.toBe(speaker);
        expect(KNOWN_BY).toHaveProperty(s);
        expect(characterById.get(s), s).toBeDefined();
      }
    }
    for (const q of Object.values(KNOWN_BY)) if (q) expect(questById.get(q), q).toBeDefined();
  });

  it('lines are whole sentences, and a later line names a real story', () => {
    for (const bySpeaker of Object.values(ABOUT))
      for (const a of Object.values(bySpeaker)) {
        const texts = typeof a === 'string' ? [a] : [a.text, a.later[1]];
        if (typeof a !== 'string') expect(questById.get(a.later[0])).toBeDefined();
        for (const t of texts) expect(t).toMatch(/[。！？]$/);
      }
  });

  it('only people whose story was shared are offered (宗吉 always), and a later story changes the word', () => {
    expect(aboutWhom('kisuke', [])).toEqual(['sokichi']);
    expect(aboutWhom('kisuke', ['kaze', 'dougu'])).toEqual(['sokichi', 'seita', 'okon', 'kinji']);
    expect(aboutWhom('sokichi', [])).toEqual([]);
    expect(aboutLine('kisuke', 'ihei', ['fumi'])).not.toBe(aboutLine('kisuke', 'ihei', []));
  });

  it('everyone who speaks has a portrait', () => {
    for (const who of [...Object.keys(FALLBACK), ...Object.keys(KNOWN_BY)]) expect(hasFace(who), who).toBe(true);
  });
});
