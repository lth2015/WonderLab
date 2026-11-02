import { describe, expect, it } from 'vitest';
import { GIFT_KINDS, GIFT_LINES, wrapNote } from './gift';

describe('贈る画の言葉', () => {
  it('has four kinds of four lines each, no repeats', () => {
    expect(GIFT_KINDS.map((k) => k.lines.length)).toEqual([4, 4, 4, 4]);
    expect(new Set(GIFT_LINES).size).toBe(16);
  });
  it('fits the page: at most two lines of 22 characters', () => {
    for (const line of GIFT_LINES) {
      const w = wrapNote(line);
      expect(w.length).toBeLessThanOrEqual(2);
      for (const part of w) {
        expect([...part].length).toBeLessThanOrEqual(23); // 22 + a hanging 。
        expect(part).not.toMatch(/^[。、」]+$/); // never a line of punctuation alone
      }
      expect(w.join('')).toBe(line);
    }
  });
  it('never carries a number (no counts, money or progress, spec §18)', () => {
    // 「町の一頁」 is "a page of the town", not a count; digits and money/progress words are out
    for (const line of GIFT_LINES) expect(line).not.toMatch(/[0-9０-９]|所持金|残高|頁目|まで集め|達成/);
  });
});
