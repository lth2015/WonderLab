import { describe, expect, it } from 'vitest';
import { bankTop } from './shore';

describe('bankTop', () => {
  const view = { width: 390, height: 844, horizonY: 464, S: 390 };
  it('runs along the bottom, high enough to draw on above the words box, and well below the horizon', () => {
    for (let x = 0; x <= 390; x += 30) {
      const top = bankTop(x, view);
      expect(top).toBeGreaterThan(view.S * 0.2);
      expect(top).toBeLessThan(view.S * 0.32);
      expect(top).toBeLessThan(view.horizonY * 0.5);
    }
    // A little higher on the left.
    expect(bankTop(0, view)).toBeGreaterThan(bankTop(390, view) - view.S * 0.03);
  });
});
