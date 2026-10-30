// 世界的逻辑 (the owner, 2026-10-30: 「白天不能有超过一个太阳，晚上不能有超过
// 一个月亮，白天看不见星星……必须符合逻辑」). Codex checks the world against a
// list of rules (collab docs/handoff/codex-world-logic.md); each rule it
// settles is written here, once, by its number, and the engine asks these
// before it makes anything. audit() checks a running world against them.
//
// The ten fixed R1 sentences are not touched by any rule here (「我想念夏天」
// stays fireflies); rules decide what the picture shows, not what a sentence means.

import type { TimeOfDay, Weather } from './intent';

export type Light = 'day' | 'dusk' | 'night';

/** The rules, by number. The words are the rule; the functions below keep it. */
export const RULES = {
  'SKY-1': '白天至多一个太阳：白天画的第一个圆是太阳，之后的圆是一朵圆云，不是第二个太阳，也不是行星。',
  'SKY-2': '夜里至多一个月亮：夜里第一个圆是月亮，之后的圆是行星（至多 3 颗）。',
  'SKY-3': '白天看不见星星和行星：已有的淡去，点天空也不闪出星星。',
  'SKY-4': '白天不见流星：白天在天上划的线是一缕云。',
  'SKY-5': '黄昏的太阳只有正在落的那一个：黄昏画的第一个圆是月亮。',
  'SKY-6': '同一笔的圆随光阴承载日光或月光：白天是太阳，黄昏与夜里是月亮；天黑不删来者的作品，也不新添第二个天体。',
  'SKY-7': '白天不见星河与流星雨：两者只在夜里显出（入水的倒影也一样）。',
  'WX-1': '萤光只在黄昏与夜里：白天说要萤火、又没说时辰，天渐入黄昏；明说白天则萤光收住。',
  'SEASON-1': '寒雪里没有蝉、蛙与萤火；早先排下的环境声，出声时再按当时的时景判断。',
  'SEASON-2': '蝉要有夏的线索（荷塘、萤火）：春柳的白天只有叶声与鸟，没有蝉。',
  'HAND-1': '人的一笔按它真正落成时的时景回应：排在队里的圆，轮到它时再问一次规则。',
  'HAND-2': '撤销一次创作，恢复这次创作之前的样子：为它让位的旧枝也一起回来。',
  'WX-2': '虹要有日光：夜里不留鲜明的日虹（入水的倒影也一样）。',
  'SOUND-1': '昼夜的环境声有分别：夜里的蟋蟀到了白天几乎听不见。',
  'SOUND-3': '减少动态不等于静音：鹊不飞、电不闪，但蝉、蛙这类只是声音的仍照常（声音开关另管）。',
} as const;

export type RuleId = keyof typeof RULES;

/** What the light is, from the atmosphere's day and dusk (0..1). */
export function lightOf(a: { day: number; dusk: number }): Light {
  if (a.day >= 0.5) return 'day';
  if (a.dusk >= 0.5) return 'dusk';
  return 'night';
}

/** SKY-1, SKY-2, SKY-5: what a circle drawn in the sky becomes. */
export function circleBecomes(light: Light, hasBody: boolean): 'sun' | 'moon' | 'planet' | 'cloud' {
  if (light === 'day') return hasBody ? 'cloud' : 'sun';
  return hasBody ? 'planet' : 'moon';
}

/** SKY-3: a dot or touch on the sky: a star only when stars can be seen. */
export function skyDotBecomes(light: Light): 'star' | 'nothing' {
  return light === 'day' ? 'nothing' : 'star';
}

/** SKY-4: an open line across the sky: a meteor only when meteors can be seen. */
export function skyLineBecomes(light: Light): 'meteor' | 'cloud' {
  return light === 'day' ? 'cloud' : 'meteor';
}

/**
 * SKY-3, SKY-4: how much of the night sky (stars, planets, meteors) shows, from
 * the atmosphere's day. Gone before the light counts as day (lightOf, 0.5);
 * the sky shader uses the same curve (shaders/world.ts, nightSky).
 */
export function nightSkyShows(day: number): number {
  const t = Math.min(Math.max((day - 0.2) / 0.3, 0), 1);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * WX-1: the time a scene command should bring. Fireflies asked for by day
 * with no time named bring dusk; a time named is kept (then SKY-3's curve
 * keeps the glow out of the daylight).
 */
export function timeForScene(cmd: { timeOfDay?: TimeOfDay; weather?: string }, light: Light): TimeOfDay | undefined {
  if (cmd.timeOfDay) return cmd.timeOfDay;
  if (cmd.weather === 'fireflies' && light === 'day') return 'dusk';
  return undefined;
}

/**
 * SEASON-1, SEASON-2: whether a cicada fits the world as it is now: a summer
 * sign (lotus, fireflies) in the weather asked for. By the weather asked for,
 * not by how far the picture has turned toward it, so a cicada queued just
 * before snow is asked for stays silent.
 */
export function cicadaFits(weather: Weather): boolean {
  return weather === 'lotus' || weather === 'fireflies';
}

/** SEASON-1: whether a frog fits: never once snow is asked for. */
export function frogFits(weather: Weather): boolean {
  return weather !== 'snow' && weather !== 'moonsnow';
}

/** What audit() looks at: what is in the picture now. */
export interface SeenWorld {
  light: Light;
  day: number;
  /** Discs in the sky the visitor drew (the sun by day, the moon otherwise). */
  bodies: number;
  /** The setting sun the dusk paints itself. */
  settingSun: boolean;
  /** Stars, planets and meteors in the sky (shown or not: nightSkyShows decides). */
  stars: number;
  planets: number;
  meteors: number;
}

/** Every rule the world breaks right now (empty when it keeps them all). */
export function audit(w: SeenWorld): { rule: RuleId; detail: string }[] {
  const out: { rule: RuleId; detail: string }[] = [];
  const suns = (w.light === 'day' ? w.bodies : 0) + (w.settingSun ? 1 : 0);
  const moons = w.light === 'day' ? 0 : w.bodies;
  if (suns > 1) out.push({ rule: w.light === 'dusk' ? 'SKY-5' : 'SKY-1', detail: `${suns} suns` });
  if (moons > 1) out.push({ rule: 'SKY-2', detail: `${moons} moons` });
  const night = nightSkyShows(w.day) > 0.001;
  if (w.light === 'day' && night && w.stars + w.planets > 0) out.push({ rule: 'SKY-3', detail: `${w.stars} stars, ${w.planets} planets showing by day` });
  if (w.light === 'day' && night && w.meteors > 0) out.push({ rule: 'SKY-4', detail: `${w.meteors} meteors showing by day` });
  return out;
}
