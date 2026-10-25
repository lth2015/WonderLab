import { describe, expect, it } from 'vitest';
import { awayEvent, growthFor, maturity, TIME } from './time';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe('growing up', () => {
  it('a newborn fish has not grown; after two weeks it is full grown and stays so', () => {
    expect(maturity(1000, 1000)).toBe(0);
    expect(maturity(0, TIME.growDays * DAY)).toBe(1);
    expect(maturity(0, 100 * DAY)).toBe(1);
    expect(maturity(undefined, 5 * DAY)).toBe(0);
    // A clock that went backwards is no reason to shrink.
    expect(maturity(10 * DAY, 0)).toBe(0);
  });

  it('grows at most a little, most in the first days, and the first fish grows the most', () => {
    expect(growthFor(0, false)).toBe(1);
    expect(growthFor(1, false)).toBeCloseTo(1 + TIME.maxGrowth);
    expect(growthFor(1, true)).toBeCloseTo(1 + TIME.honmeiMaxGrowth);
    expect(growthFor(0.5, true)).toBeGreaterThan(growthFor(0.5, false));
    // Eased: half the time brings more than half the growth.
    expect(growthFor(0.5, false) - 1).toBeGreaterThan(TIME.maxGrowth / 2);
    expect(TIME.honmeiMaxGrowth).toBeLessThanOrEqual(0.2);
  });
});

describe('while you were away', () => {
  const world = { raining: false, honmeiWithHome: true };

  it('nothing happens over a refresh or a short break', () => {
    expect(awayEvent(0, world)).toBeNull();
    expect(awayEvent(TIME.awayMs - 1, world)).toBeNull();
  });

  it('after a while, exactly one small thing', () => {
    expect(awayEvent(TIME.awayMs, world, () => 0)).toBe('star');
    expect(awayEvent(TIME.awayMs, world, () => 0.99)).toBe('honmei_home');
    expect(awayEvent(TIME.awayMs, { raining: false, honmeiWithHome: false }, () => 0.99)).toBe('star');
  });

  it('a night’s rain has stopped after hours away, not after half an hour', () => {
    expect(awayEvent(TIME.awayMs, { raining: true, honmeiWithHome: false }, () => 0)).toBe('star');
    expect(awayEvent(8 * HOUR, { raining: true, honmeiWithHome: true })).toBe('rain_stopped');
  });
});
