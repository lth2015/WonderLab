import { POEMS, type Poem } from './poems';
import type { Mood, SceneCommand } from './engine/intent';

// Local choice of an echo line (docs/02 §5.3): scored by the scene the
// sentence asked for, its mood and the images it names. Also yields the
// shortlist the AI chooses from, so the model sees a few dozen lines, not all.

const SUBJECTS: [RegExp, string][] = [
  [/月|婵娟|玉盘/, 'moon'],
  [/星|银河|银汉/, 'star'],
  [/鱼|锦鲤|鲤/, 'fish'],
  [/风/, 'wind'],
  [/水|湖|江|河|海|潭|池|溪|泉/, 'water'],
  [/山|峰|岭/, 'mountain'],
  [/云/, 'cloud'],
  [/花|荷|莲|桃|梅|菊/, 'flower'],
  [/船|舟|帆/, 'boat'],
  [/雪|冰|寒/, 'snow'],
  [/家|乡|归/, 'home'],
  [/朋友|友|知己|兄弟|同学/, 'friend'],
  [/爱|恋|你|思念|想念|相思|喜欢/, 'love'],
  [/春/, 'spring'],
  [/夏/, 'summer'],
  [/秋/, 'autumn'],
  [/冬/, 'winter'],
];

export function subjectsOf(text: string): string[] {
  return SUBJECTS.filter(([re]) => re.test(text)).map(([, tag]) => tag);
}

function score(p: Poem, cmd: SceneCommand, mood: Mood, subjects: string[]): number {
  let s = 0;
  if (cmd.weather && cmd.weather !== 'clear' && p.tags.includes(cmd.weather)) s += 3;
  if (cmd.weather === 'clear' && p.tags.includes('clear')) s += 1;
  // 月夜 is not a weather in the poems' tags: lines about the moon answer it.
  if (cmd.weather === 'moonlit' && p.tags.includes('moon')) s += 3;
  if (cmd.weather === 'autumn' && p.tags.includes('autumn')) s += 3;
  if (cmd.weather === 'storm' && p.tags.includes('rain')) s += 3;
  if (cmd.weather === 'shower' && p.tags.includes('star')) s += 3;
  if (cmd.timeOfDay && p.tags.includes(cmd.timeOfDay)) s += 2;
  if (p.tags.includes(mood)) s += 2;
  for (const t of subjects) if (p.tags.includes(t)) s += 2;
  return s;
}

/** Best lines first, recently shown ones left out, ties broken at random. */
export function rankPoems(
  cmd: SceneCommand,
  mood: Mood,
  text: string,
  recent: number[] = [],
  random: () => number = Math.random,
): Poem[] {
  const subjects = subjectsOf(text);
  return POEMS.filter((p) => !recent.includes(p.id))
    .map((p) => ({ p, s: score(p, cmd, mood, subjects) + random() * 0.9 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

export function pickPoem(cmd: SceneCommand, mood: Mood, text: string, recent: number[] = []): Poem {
  return rankPoems(cmd, mood, text, recent)[0];
}
