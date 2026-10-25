import { describe, expect, it } from 'vitest';
import { describeWorld } from './describe';
import { INITIAL } from './engine/atmosphere';

const fish = { spine: [[0.1, 0.1], [0.2, 0.2]] as [number, number][], drawSpeed: 1, seed: 1, patch: 0 };
const empty = { atmosphere: { ...INITIAL }, fish: [], moon: null, planets: [], stars: [], clouds: [] };

describe('describeWorld', () => {
  it('reads the docs/03 §8 example', () => {
    expect(
      describeWorld({
        ...empty,
        atmosphere: { ...INITIAL, weather: 'rain' },
        moon: { x: 0.5, y: 0.8, r: 0.05, phase: 'full', dark: [1, 0] },
        fish: [fish, fish, fish],
      }),
    ).toBe('夜晚的湖面，有月亮和三条小鱼，正在下小雨');
  });

  it('says an empty lake is empty', () => {
    expect(describeWorld(empty)).toBe('夜晚的湖面，还空着');
  });

  it('lists several things and the time of day', () => {
    expect(
      describeWorld({
        ...empty,
        atmosphere: { ...INITIAL, timeOfDay: 'dusk', weather: 'mist' },
        moon: { x: 0.5, y: 0.8, r: 0.05, phase: 'full', dark: [1, 0] },
        planets: [[0.3, 0.8, 0.02, 0], [0.6, 0.85, 0.02, 1]],
        stars: [[0.1, 0.9]],
        clouds: [[0.5, 0.75, 0.2]],
        fish: [fish, fish],
      }),
    ).toBe('黄昏的湖面，有月亮、两颗小星球、一颗星、一缕流云和两条小鱼，起了雾');
  });
});
