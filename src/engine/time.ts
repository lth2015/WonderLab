// 时间赋予生命以意义 (docs/02 §5.6). The world goes on while the user is
// away, but never punishes them for leaving: no hunger, no illness, no
// streaks, no notifications. Two things change with real time:
//
//  - each fish grows a little over its first two weeks, and its colours
//    settle a shade deeper; the first fish (本命鱼) grows the most;
//  - coming back after a while, one small thing has happened while they
//    were away — never more than one, never announced.
//
// Pure, so the rules are tested without a renderer. Values mirror 03 §7.1.

export const TIME = {
  /** Days for a fish to reach its full size. */
  growDays: 14,
  /** How much longer and wider a fish gets at most. */
  maxGrowth: 0.12,
  honmeiMaxGrowth: 0.18,
  /** Away at least this long (ms) and something will have happened. A refresh changes nothing. */
  awayMs: 30 * 60 * 1000,
  /** Away at least this long (ms) and a night's rain will have stopped. */
  rainStopMs: 3 * 60 * 60 * 1000,
};

const DAY = 24 * 60 * 60 * 1000;

/** How far along its growing a fish is, 0..1, from when it was born. */
export function maturity(bornAt: number | undefined, now: number): number {
  if (bornAt === undefined || !(now > bornAt)) return 0;
  return Math.min((now - bornAt) / (TIME.growDays * DAY), 1);
}

/**
 * A saved fish coming back to life, in the lake or from afar. Its saved body
 * already embodies `was` (the size multiplier it had when it was last made),
 * so it grows by the rest: whatever was saved, left or came back in between,
 * its size is growthFor(maturity(now)) of what was drawn. Never smaller than
 * before, even if the clock moved back.
 */
export function regrow(was: number, bornAt: number, now: number, honmei: boolean): { size: number; ratio: number } {
  const size = Math.max(growthFor(maturity(bornAt, now), honmei), was);
  return { size, ratio: size / was };
}

/** Size multiplier for a fish of the given maturity; eased, so the first days show most. */
export function growthFor(m: number, honmei: boolean): number {
  const eased = 1 - (1 - m) * (1 - m);
  return 1 + (honmei ? TIME.honmeiMaxGrowth : TIME.maxGrowth) * eased;
}

export type AwayEvent = 'rain_stopped' | 'honmei_home' | 'star';

/**
 * What happened while the user was away, if anything: one event, chosen from
 * those that fit the world as it was left.
 */
export function awayEvent(
  awayMs: number,
  world: { raining: boolean; honmeiWithHome: boolean },
  random: () => number = Math.random,
): AwayEvent | null {
  if (!(awayMs >= TIME.awayMs)) return null;
  const options: AwayEvent[] = ['star'];
  if (world.honmeiWithHome) options.push('honmei_home');
  // A night's rain has stopped: only after hours away, and then it is what you notice first.
  if (world.raining && awayMs >= TIME.rainStopMs) return 'rain_stopped';
  return options[Math.floor(random() * options.length) % options.length];
}
