import { describe, expect, it } from 'vitest';
import { FALLBACK, TODAY_AT, todayLine } from './talk';

describe('今日の町のこと（台本）', () => {
  it('everyone who talks has an evening word and a rain word', () => {
    for (const who of Object.keys(FALLBACK)) {
      expect(TODAY_AT[who]?.evening, who).toMatch(/[。！？]$/);
      expect(TODAY_AT[who]?.rain, who).toMatch(/[。！？]$/);
    }
  });
  it('the rain wins over the hour; morning and noon keep the base word', () => {
    expect(todayLine('kisuke', 'evening', true)).toBe(TODAY_AT.kisuke.rain);
    expect(todayLine('kisuke', 'evening', false)).toBe(TODAY_AT.kisuke.evening);
    expect(todayLine('kisuke', 'noon', false)).toBe(FALLBACK.kisuke.today);
    expect(todayLine('kisuke', 'morning', false)).toBe(FALLBACK.kisuke.today);
    expect(todayLine('nobody', 'evening', true)).toBeUndefined();
  });
});
