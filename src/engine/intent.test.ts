import { describe, expect, it } from 'vitest';
import { FIXED_SENTENCES } from './fixed-sentences';
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

  it('reads snow in three strengths, quiet unless it is heavy', () => {
    const light = interpret('下小雪了').command;
    const medium = interpret('下中雪').command;
    const heavy = interpret('下大雪吧').command;
    const plain = interpret('下雪了').command;
    for (const c of [light, medium, heavy, plain]) expect(c.weather).toBe('snow');
    expect(light.intensity!).toBeLessThan(medium.intensity!);
    expect(medium.intensity!).toBeLessThan(heavy.intensity!);
    expect(heavy.wind!).toBeGreaterThan(light.wind!);
    expect(plain.wind!).toBeLessThan(0.2);
    expect(interpret('下雪了，想家').command).toMatchObject({ weather: 'snow', palette: 'melancholy' });
    expect(interpret('独钓寒江雪').command.weather).toBe('snow');
  });

  it('brings out the moonlight for 月夜, never a moon', () => {
    for (const s of ['今晚月色真美', '月夜', '月光洒在湖上', '明月几时有']) expect(interpret(s).command).toMatchObject({ weather: 'moonlit', timeOfDay: 'night' });
    expect(interpret('不要月光').command.weather).toBe('clear');
    expect(interpret('深夜').command.weather).toBeUndefined();
  });

  it('reads autumn wind and falling leaves', () => {
    for (const t of ['秋风', '落叶纷纷', '秋天到了']) expect(interpret(t).command).toMatchObject({ weather: 'autumn' });
    expect(interpret('不要落叶').command.weather).toBe('clear');
  });

  it('stops rain and snow when asked', () => {
    for (const s of ['雨停了', '雪停了', '不要下雪', '别下雪了']) expect(interpret(s).command.weather).toBe('clear');
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

describe('words for the fish (画是主角，写是魔法)', () => {
  it('reads what the words ask of the fish', () => {
    expect(interpret('它想看看外面的世界').command.fish).toBe('explore');
    expect(interpret('大家在一起吧').command.fish).toBe('gather');
    expect(interpret('累了，睡吧').command.fish).toBe('rest');
    expect(interpret('一起跳舞').command.fish).toBe('gather');
    expect(interpret('跳起来玩吧').command.fish).toBe('play');
  });

  it('keeps the mood words working alongside', () => {
    const c = interpret('雨夜里，鱼儿想去远方').command;
    expect(c).toMatchObject({ weather: 'rain', fish: 'explore' });
  });

  it('skips a negated wish', () => {
    expect(interpret('不想出去').command.fish).toBeUndefined();
  });

  it('leaves the fish alone when the words do not ask', () => {
    expect(interpret('今夜下一场小雨').command.fish).toBeUndefined();
    expect(interpret('我想念夏天').command.fish).toBeUndefined();
  });

  it('accepts only known intents from the AI, and never overrides a keyword', () => {
    expect(validateCommand({ fish: 'explore' })).toEqual({ fish: 'explore' });
    expect(validateCommand({ fish: 'fly' })).toEqual({});
    expect(mergeAi(interpret('想去远方'), { fish: 'rest' })).toEqual({});
    expect(mergeAi(interpret('明天会更好'), { fish: 'play' })).toEqual({ fish: 'play' });
  });
});

describe('rule changes before the freeze (docs/验证路线图.md §2)', () => {
  it('a negated wish never starts what it names', () => {
    // Any keyword added from the calibration set must keep these.
    for (const s of ['不想下雨', '别下雨了', '不要下雨', '不要起雾', '别起雾']) expect(interpret(s).command.weather).not.toMatch(/rain|mist/);
    expect(interpret('不想要萤火虫').command.weather).not.toBe('fireflies');
    expect(interpret('我不开心').command.palette).not.toBe('warm');
  });

  it('records how the ten fixed R1 sentences are read: a change here goes in the roadmap appendix', () => {
    // Recorded, not a target: 天快黑了 and 一个人的晚上 are not caught by a keyword, and stay in the set.
    expect(FIXED_SENTENCES.map((s) => interpret(s).source)).toEqual([
      'keyword',
      'keyword',
      'sentiment',
      'keyword',
      'keyword',
      'keyword',
      'keyword',
      'keyword',
      'keyword',
      'sentiment',
    ]);
  });
});

