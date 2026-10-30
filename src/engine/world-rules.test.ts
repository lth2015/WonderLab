import { describe, expect, it } from 'vitest';
import { audit, cicadaFits, circleBecomes, frogFits, lightOf, nightSkyShows, RULES, skyDotBecomes, skyLineBecomes, timeForScene, type SeenWorld } from './world-rules';
import { interpret } from './intent';

const calm: SeenWorld = { light: 'night', day: 0, bodies: 0, settingSun: false, stars: 0, planets: 0, meteors: 0 };

describe('world rules', () => {
  it('names every rule it keeps', () => {
    expect(Object.keys(RULES)).toEqual(['SKY-1', 'SKY-2', 'SKY-3', 'SKY-4', 'SKY-5', 'SKY-6', 'SKY-7', 'WX-1', 'SEASON-1', 'SEASON-2', 'HAND-1']);
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

  it('WX-1: fireflies asked for by day bring dusk; a time named is kept; the fixed sentence still means fireflies', () => {
    const cmd = interpret('萤火虫飞起来吧').command;
    expect(cmd.weather).toBe('fireflies');
    expect(timeForScene(cmd, 'day')).toBe('dusk');
    expect(timeForScene(cmd, 'night')).toBeUndefined();
    expect(timeForScene({ weather: 'fireflies', timeOfDay: 'day' }, 'night')).toBe('day');
    expect(timeForScene({ weather: 'lotus' }, 'day')).toBeUndefined();
    expect(interpret('我想念夏天').command.weather).toBe('fireflies');
  });

  it('SEASON-1, SEASON-2: cicadas need a summer sign in the weather asked for; frogs never once snow is asked for', () => {
    expect(cicadaFits('lotus')).toBe(true);
    expect(cicadaFits('fireflies')).toBe(true);
    for (const w of ['clear', 'snow', 'moonsnow', 'autumn', 'rain', 'storm'] as const) expect(cicadaFits(w), w).toBe(false);
    expect(frogFits('snow')).toBe(false);
    expect(frogFits('moonsnow')).toBe(false);
    expect(frogFits('lotus')).toBe(true);
  });
});
