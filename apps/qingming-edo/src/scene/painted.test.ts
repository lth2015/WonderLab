import { describe, expect, it } from 'vitest';
import { CROWD, SPOTS } from './painted';

describe('people along the scroll', () => {
  it('does not clone any passer-by silhouette across the world', () => {
    expect(CROWD.length).toBeGreaterThan(0);
    expect(new Set(CROWD.map(person => person.id)).size).toBe(CROWD.length);
  });
  it('leaves the story characters and walkable foreground clear', () => {
    for (const person of CROWD) {
      expect(Object.values(SPOTS).every(spot => Math.abs(spot.x - person.x) >= 100)).toBe(true);
      expect(person.y).toBeGreaterThanOrEqual(590);
      expect(person.y).toBeLessThanOrEqual(630);
    }
  });
});
