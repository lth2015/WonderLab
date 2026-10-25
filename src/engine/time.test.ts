import { describe, expect, it } from 'vitest';
import { awayEvent, growthFor, maturity, regrow, TIME } from './time';

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

describe('one growth rule, in the lake or far away', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const drawn = 100;

  // A fish's life as the save sees it: made at `t`, its body (length) saved
  // whenever the world is saved, then made again from that body. Leaving the
  // lake and coming back is the same save-and-make, just later.
  function live(times: number[], honmei = false) {
    let length = drawn;
    let size = 1;
    const lengths: number[] = [];
    for (const t of times) {
      const r = regrow(size, 0, t, honmei);
      length *= r.ratio;
      size = r.size;
      lengths.push(length);
    }
    return lengths;
  }

  it('after any number of sessions, departures and returns, its size is what its age says', () => {
    // Opened every few hours, sent far away on day 3, back on day 9, away again on day 10, back on day 20.
    const times = [0.1, 0.5, 1, 2.2, 3, 9, 9.4, 10, 20, 30].map((d) => d * DAY);
    const lengths = live(times);
    times.forEach((t, i) => expect(lengths[i]).toBeCloseTo(drawn * growthFor(maturity(0, t), false), 9));
    expect(lengths.at(-1)).toBeCloseTo(drawn * (1 + TIME.maxGrowth), 9);
    expect(live(times, true).at(-1)).toBeCloseTo(drawn * (1 + TIME.honmeiMaxGrowth), 9);
  });

  it('never shrinks and never counts the same days twice', () => {
    const many = Array.from({ length: 200 }, (_, i) => i * 0.1 * DAY);
    const lengths = live(many);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
    expect(lengths.at(-1)).toBeCloseTo(drawn * growthFor(maturity(0, many.at(-1)!), false), 9);
    // Made again and again at the same moment: nothing added.
    expect(live([5 * DAY, 5 * DAY, 5 * DAY])).toEqual(Array(3).fill(live([5 * DAY])[0]));
  });

  it('a clock set back does not shrink a fish', () => {
    const [a, b] = live([10 * DAY, 2 * DAY]);
    expect(b).toBe(a);
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
