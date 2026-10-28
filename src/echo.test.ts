import { describe, expect, it } from 'vitest';
import { POEMS, poemById } from './poems';
import { interpret } from './engine/intent';
import { rankPoems, subjectsOf } from './echo';

const fixed = () => 0.5;

function top(text: string) {
  const { command, mood } = interpret(text);
  return rankPoems(command, mood, text, [], fixed)[0];
}

describe('poem library', () => {
  it('has well-formed, unique lines with stable ids', () => {
    expect(POEMS.length).toBeGreaterThanOrEqual(140);
    expect(new Set(POEMS.map((p) => p.text)).size).toBe(POEMS.length);
    POEMS.forEach((p, i) => {
      expect(p.id).toBe(i + 1);
      expect(p.text.length).toBeLessThanOrEqual(26);
      expect(p.author.length).toBeGreaterThan(0);
      expect(p.tags.length).toBeGreaterThan(0);
    });
    expect(poemById(1)?.text).toBe('好雨知时节，当春乃发生。');
  });
});

describe('echo choice', () => {
  it('answers rain with a rain line', () => {
    expect(top('今夜下一场小雨').tags).toContain('rain');
  });
  it('answers dusk with a dusk line', () => {
    expect(top('黄昏的湖边').tags).toContain('dusk');
  });
  it('follows the images named in the sentence', () => {
    expect(subjectsOf('想看月亮和锦鲤')).toEqual(['moon', 'fish']);
    expect(top('月亮好圆').tags).toContain('moon');
    // 月光 names no moon, but a moonlit night is answered with a moon line.
    expect(top('月光').tags).toContain('moon');
    expect(top('湖里的鱼').tags).toContain('fish');
  });
  it('reads longing for home as low, not bright', () => {
    const t = top('湖上的月亮，好想家');
    expect(t.tags).toEqual(expect.arrayContaining(['home', 'low']));
  });
  it('does not repeat recent lines', () => {
    const { command, mood } = interpret('下雨');
    const first = rankPoems(command, mood, '下雨', [], fixed)[0];
    expect(rankPoems(command, mood, '下雨', [first.id], fixed)[0].id).not.toBe(first.id);
  });
});
