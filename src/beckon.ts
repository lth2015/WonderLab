// 发现入口: the scenes are behind words a visitor may never think to write
// (星河, 放河灯…). Once the visitor has written something and then rested a
// while, a line drifts faintly into the sky; touching it says it for them,
// as if written. One scene at a time, never one already seen, and rarely.
// Pure, so the lines can be checked against the rules they must reach.

import type { Weather } from './engine/intent';

/** Each line, and the scene it must bring (intent.test checks the pairing). */
export const BECKONS: readonly { text: string; weather: Weather }[] = [
  { text: '满船清梦压星河', weather: 'galaxy' },
  { text: '放一盏河灯，许个心愿', weather: 'lanterns' },
  { text: '等一场流星雨', weather: 'shower' },
  { text: '月下飘雪', weather: 'moonsnow' },
  { text: '听一场雷雨', weather: 'storm' },
  { text: '秋风起，落叶满湖', weather: 'autumn' },
  { text: '桃花落满湖', weather: 'blossom' },
  { text: '月色入户', weather: 'moonlit' },
  { text: '夏夜的萤火', weather: 'fireflies' },
];

export const BECKON = {
  /** Quiet this long (no touch, key or words) before a line comes. */
  idleMs: 40_000,
  /** At least this long between lines. */
  everyMs: 120_000,
  /** How long a line stays. */
  showMs: 14_000,
  /** At most this many in one visit. */
  max: 4,
};

/** The next line to offer: a scene not yet seen, nor the one now; null when none is left. */
export function pickBeckon(seen: ReadonlySet<Weather>, now: Weather, random: () => number = Math.random): { text: string; weather: Weather } | null {
  const open = BECKONS.filter((b) => !seen.has(b.weather) && b.weather !== now);
  if (!open.length) return null;
  // The first few are the most striking; favour them, with a little chance.
  const i = Math.min(Math.floor(random() * random() * open.length * 1.5), open.length - 1);
  return open[i];
}
