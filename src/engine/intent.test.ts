import { describe, expect, it } from 'vitest';
import { interpret } from './intent';

describe('interpret', () => {
  it('maps the placeholder sentences', () => {
    expect(interpret('今夜下一场小雨').command.weather).toBe('rain');
    expect(interpret('我想念夏天').command).toMatchObject({ weather: 'fireflies', palette: 'melancholy' });
    expect(interpret('让世界安静下来').command).toMatchObject({ palette: 'serene', wind: 0.05 });
  });

  it('covers the docs/02 §5.3 examples', () => {
    expect(interpret('起雾了').command.weather).toBe('mist');
    expect(interpret('朦胧的湖').command.weather).toBe('mist');
    expect(interpret('黄昏的湖边').command.timeOfDay).toBe('dusk');
    expect(interpret('夕阳').command.timeOfDay).toBe('dusk');
    expect(interpret('好孤独').command.palette).toBe('melancholy');
    expect(interpret('今天很开心').command.palette).toBe('warm');
    expect(interpret('萤火虫').command.weather).toBe('fireflies');
  });

  it('respects simple negation', () => {
    expect(interpret('不要下雨').command.weather).toBe('clear');
    expect(interpret('我不开心').command.palette).not.toBe('warm');
  });

  it('falls back to sentiment when no keyword hits', () => {
    const r = interpret('明天会更好');
    expect(r.source).toBe('sentiment');
    expect(r.command.palette).toBe('warm');
    expect(interpret('有点累').command.palette).toBe('melancholy');
    expect(interpret('一只猫').command.palette).toBe('serene');
  });

  it('combines several hits without later rules overriding earlier ones', () => {
    const r = interpret('黄昏下起了大雨，有点难过');
    expect(r.command).toMatchObject({ timeOfDay: 'dusk', weather: 'rain', palette: 'melancholy', intensity: 0.9 });
  });

  it('always answers, even for empty or odd input', () => {
    for (const s of ['', '   ', '1234', 'hello', '？？？']) {
      expect(Object.keys(interpret(s).command).length).toBeGreaterThan(0);
    }
  });
});

import { mergeAi, validateCommand } from './intent';

describe('validateCommand', () => {
  it('keeps valid fields, drops the rest, clamps numbers', () => {
    expect(validateCommand({ weather: 'rain', palette: 'neon', timeOfDay: 'dawn', wind: 3, intensity: -1, echo: 'x' })).toEqual({
      weather: 'rain',
      wind: 1,
      intensity: 0,
    });
    expect(validateCommand('rain')).toEqual({});
    expect(validateCommand(null)).toEqual({});
  });
});

describe('mergeAi', () => {
  it('never overrides what a keyword set', () => {
    const local = interpret('今夜下一场小雨');
    expect(mergeAi(local, { weather: 'mist', palette: 'melancholy', intensity: 0.4 })).toEqual({ palette: 'melancholy', intensity: 0.4 });
  });
  it('may refine a sentiment guess', () => {
    const local = interpret('明天会更好');
    expect(mergeAi(local, { palette: 'serene', timeOfDay: 'dusk' })).toEqual({ palette: 'serene', timeOfDay: 'dusk' });
  });
});
