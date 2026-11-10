import { describe, expect, it } from 'vitest';
import { HOTSPOTS } from '../content/world';
import { newSave } from '../engine/state';
import { visibleSpots } from '../engine/story';
import { CROWD, outAt, SPOTS } from './painted';

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

describe('通りすがりの人 (tap a walker)', () => {
  it('every passer-by can be spoken to, exactly when they are out walking', () => {
    for (const [i, c] of CROWD.entries()) {
      const spot = HOTSPOTS.find((h) => h.walker === c.id && h.kind === 'ambient') ?? HOTSPOTS.find((h) => h.walker === c.id);
      expect(spot, c.id).toBeDefined();
      expect(spot!.anchor.x).toBe(c.x);
      for (const t of ['morning', 'noon', 'evening'] as const) {
        // all three times reached (engine/time.ts), then shown at t
        const base = newSave();
        const s = { ...base, progress: { ...base.progress, quests: { kaze: 'complete', dougu: 'complete', tenugui: 'complete' } }, settings: { ...base.settings, timeChoice: t } } as typeof base;
        const shown = visibleSpots(s).some((h) => h.id === spot!.id);
        // the clerk of 母への文 is a story person: his spot waits for the story
        if (c.id !== 'crowd1-merchant') expect(shown, `${c.id} ${t}`).toBe(outAt(t, c.id, i));
      }
    }
  });
});
