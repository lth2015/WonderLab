import { describe, expect, it } from 'vitest';
import { audit, circleBecomes, lightOf, nightSkyShows, RULES, skyDotBecomes, skyLineBecomes, type SeenWorld } from './world-rules';

const calm: SeenWorld = { light: 'night', day: 0, bodies: 0, settingSun: false, stars: 0, planets: 0, meteors: 0 };

describe('world rules', () => {
  it('names every rule it keeps', () => {
    expect(Object.keys(RULES)).toEqual(['SKY-1', 'SKY-2', 'SKY-3', 'SKY-4', 'SKY-5']);
  });

  it('reads the light from the atmosphere', () => {
    expect(lightOf({ day: 1, dusk: 0 })).toBe('day');
    expect(lightOf({ day: 0, dusk: 1 })).toBe('dusk');
    expect(lightOf({ day: 0.2, dusk: 0.2 })).toBe('night');
  });

  it('SKY-1: one sun by day; another circle is a cloud', () => {
    expect(circleBecomes('day', false)).toBe('sun');
    expect(circleBecomes('day', true)).toBe('cloud');
  });

  it('SKY-2: one moon by night; further circles are planets', () => {
    expect(circleBecomes('night', false)).toBe('moon');
    expect(circleBecomes('night', true)).toBe('planet');
  });

  it('SKY-5: at dusk the setting sun is the only sun; a circle is the moon', () => {
    expect(circleBecomes('dusk', false)).toBe('moon');
  });

  it('SKY-3, SKY-4: no stars or meteors made by day', () => {
    expect(skyDotBecomes('day')).toBe('nothing');
    expect(skyDotBecomes('dusk')).toBe('star');
    expect(skyLineBecomes('day')).toBe('cloud');
    expect(skyLineBecomes('night')).toBe('meteor');
  });

  it('the night sky is gone before the light counts as day', () => {
    expect(nightSkyShows(0)).toBe(1);
    expect(nightSkyShows(0.5)).toBe(0);
    expect(nightSkyShows(0.35)).toBeGreaterThan(0);
    for (let d = 0; d <= 1; d += 0.05) if (lightOf({ day: d, dusk: 0 }) === 'day') expect(nightSkyShows(d)).toBe(0);
  });

  it('audit finds what breaks the rules, and nothing in a world that keeps them', () => {
    expect(audit(calm)).toEqual([]);
    expect(audit({ ...calm, light: 'day', day: 1, bodies: 1, stars: 5, planets: 2 })).toEqual([]);
    expect(audit({ ...calm, light: 'day', day: 0.45, bodies: 1, stars: 1 }).map((b) => b.rule)).toEqual(['SKY-3']);
    expect(audit({ ...calm, light: 'day', day: 1, bodies: 2 }).map((b) => b.rule)).toEqual(['SKY-1']);
    expect(audit({ ...calm, bodies: 2 }).map((b) => b.rule)).toEqual(['SKY-2']);
    expect(audit({ ...calm, light: 'dusk', settingSun: true, bodies: 1 })).toEqual([]);
  });
});
