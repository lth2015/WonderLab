import { describe, expect, it } from 'vitest';
import { interpret } from './engine/intent';
import { FIXED_SENTENCES } from './engine/fixed-sentences';
import { SCENES, sceneFromPath, sceneUrl, SEASONS, timeForHour } from './scenes';

describe('scenes (四时册页)', () => {
  it('each line brings the weather it promises, and does not fight the time set for it', () => {
    for (const s of SCENES) {
      const c = interpret(s.line).command;
      expect(c.weather, s.line).toBe(s.weather);
      if (c.timeOfDay && s.time) expect(c.timeOfDay, s.line).toBe(s.time);
    }
  });

  it('every scene has its own id and name, a season, and is not one of the fixed sentences', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    expect(new Set(SCENES.map((s) => s.name)).size).toBe(SCENES.length);
    for (const s of SCENES) {
      expect(SEASONS).toContain(s.season);
      expect(FIXED_SENTENCES as readonly string[]).not.toContain(s.line);
    }
  });

  it('finds a scene from its address, by name or id, and nothing else', () => {
    expect(sceneFromPath('/柳')?.id).toBe('willow');
    expect(sceneFromPath('/%E6%9F%B3')?.id).toBe('willow');
    expect(sceneFromPath('/Lotus')?.id).toBe('lotus');
    expect(sceneFromPath('/星河/')?.id).toBe('galaxy');
    for (const p of ['/', '', '/checkout/complete', '/auth/google/callback', '/pricing', '/%E0%A4%A']) expect(sceneFromPath(p)).toBeNull();
  });

  it('gives an address that leads back to the scene', () => {
    for (const s of SCENES) expect(sceneFromPath(new URL(sceneUrl(s, 'https://want.world')).pathname)).toBe(s);
  });

  it('a first visit sees the hour it is', () => {
    expect(timeForHour(9)).toBe('day');
    expect(timeForHour(18)).toBe('dusk');
    expect(timeForHour(22)).toBe('night');
    expect(timeForHour(3)).toBe('night');
  });
});
