import { describe, expect, it } from 'vitest';
import { interpret } from './intent';
import { MAX_DENSITY, snowLevel } from './snow';

describe('snowLevel', () => {
  it('matches the prototypes the owner chose: 小雪 sparse, 中雪 the reference, 大雪 generous', () => {
    const at = (s: string) => snowLevel(interpret(s).command.intensity!);
    expect(at('下小雪了').density).toBeCloseTo(0.35, 2);
    expect(at('下中雪').density).toBeCloseTo(1, 2);
    expect(at('下大雪').density).toBeCloseTo(MAX_DENSITY, 2);
    expect(at('下大雪').speed).toBeGreaterThan(at('下中雪').speed);
  });

  it('only grows with intensity and stays in range', () => {
    let last = -1;
    for (let i = -0.5; i <= 1.5; i += 0.05) {
      const { density, speed } = snowLevel(i);
      expect(density).toBeGreaterThanOrEqual(last);
      expect(density).toBeLessThanOrEqual(MAX_DENSITY);
      expect(speed).toBeGreaterThan(0);
      last = density;
    }
  });
});
