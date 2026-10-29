// 一句成境, local half (docs/02 §5.3): keywords first, then a small
// sentiment dictionary. Pure, so it can be tested and reused when the AI
// result is merged in stage B (local fields win).
//
// 画是主角，写是魔法 (docs/02 §5.3): words never create a fish or a moon.
// They change the world's mood, and give the fish already there something
// to do (`fish`): explore, gather, rest or play.

export type TimeOfDay = 'night' | 'dusk';
export type Weather = 'clear' | 'rain' | 'mist' | 'fireflies' | 'snow' | 'moonlit' | 'autumn' | 'storm' | 'shower' | 'galaxy' | 'lanterns' | 'moonsnow' | 'blossom';
export const WEATHERS: readonly Weather[] = ['clear', 'rain', 'mist', 'fireflies', 'snow', 'moonlit', 'autumn', 'storm', 'shower', 'galaxy', 'lanterns', 'moonsnow', 'blossom'];
export type PaletteName = 'serene' | 'warm' | 'melancholy';
/** What the words ask of the fish already in the lake. */
export type FishIntent = 'explore' | 'gather' | 'rest' | 'play';
export const FISH_INTENTS: readonly FishIntent[] = ['explore', 'gather', 'rest', 'play'];

/** The constrained scene command. Every field is optional. */
export interface SceneCommand {
  timeOfDay?: TimeOfDay;
  weather?: Weather;
  palette?: PaletteName;
  wind?: number;      // 0..1
  intensity?: number; // 0..1
  fish?: FishIntent;
}

export type Mood = 'bright' | 'low' | 'calm';

export interface Interpretation {
  command: SceneCommand;
  /** 'keyword' when any keyword hit, otherwise the sentiment fallback. */
  source: 'keyword' | 'sentiment';
  mood: Mood;
}

type Rule = [words: string[], set: SceneCommand];

// Longer words are listed first inside each rule so that e.g. 不下雨 can be
// caught before 雨 (see NEGATIONS).
const KEYWORDS: Rule[] = [
  // Before rain and snow, or their 雨 / 雪 would take these.
  [['雨停', '雪停', '雨过天晴'], { weather: 'clear' }],
  // 河灯与孔明灯: lamps set afloat on the lake, lanterns rising into the night.
  [['放河灯', '河灯', '放灯', '孔明灯', '天灯', '灯笼', '许个心愿'], { weather: 'lanterns', timeOfDay: 'night' }],
  // 星河: the Milky Way rising from behind the hills and across the sky, and in the lake.
  [['银河', '星河', '天河', '满天星', '星空', '繁星'], { weather: 'galaxy', timeOfDay: 'night' }],
  // 流星雨: meteors streaming across the sky from one point; now and then one falls into the lake.
  [['流星雨', '星雨', '许个愿', '许愿', '流星'], { weather: 'shower', timeOfDay: 'night' }],
  // 雷雨: heavy rain, and now and then lightning over the far hills and the thunder after it.
  [['电闪雷鸣', '雷雨', '打雷', '雷声', '雷电', '闪电', '雷'], { weather: 'storm', intensity: 0.9, wind: 0.65 }],
  [['暴雨', '大雨', '倾盆'], { weather: 'rain', intensity: 0.9, wind: 0.6 }],
  [['下雨', '小雨', '细雨', '春雨', '雨夜', '雨声', '淋雨', '雨'], { weather: 'rain' }],
  // Snow: heavy, medium, light, then any snow. Quiet by default: little wind,
  // so the lake goes still; heavy snow slants a little.
  [['暴雪', '大雪', '鹅毛', '漫天飞雪', '风雪'], { weather: 'snow', intensity: 0.95, wind: 0.35 }],
  [['中雪'], { weather: 'snow', intensity: 0.6, wind: 0.12 }],
  [['小雪', '细雪', '微雪', '初雪'], { weather: 'snow', intensity: 0.25, wind: 0.06 }],
  [['下雪', '飘雪', '落雪', '雪夜', '雪花', '雪景', '寒江', '冬夜', '冬天', '雪'], { weather: 'snow', wind: 0.08 }],
  // Moonlight: words cannot make a moon (画是主角), they bring out its light.
  [['月夜', '月光', '月色', '明月', '皓月', '月明', '月下', '月华', '赏月', '月亮出来'], { weather: 'moonlit', timeOfDay: 'night' }],
  // 秋风落叶: wind, and leaves blown across the night onto the lake.
  [['秋风', '落叶', '枫叶', '红叶', '叶落', '秋叶', '萧萧', '秋天'], { weather: 'autumn', wind: 0.55, palette: 'melancholy' }],
  // 落花: spring petals drifting down onto the lake (after rain, so 春雨 stays rain).
  [['桃花', '樱花', '梨花', '杏花', '落花', '花瓣', '飞花', '春风', '春天'], { weather: 'blossom', wind: 0.3 }],
  [['雾', '朦胧', '迷蒙', '烟波', '云雾', '模糊', '看不清'], { weather: 'mist' }],
  [['萤火', '流萤', '萤', '夏夜', '夏天', '盛夏', '蝉'], { weather: 'fireflies' }],
  [['晴', '星星', '天亮了', '放晴'], { weather: 'clear' }],
  [['黄昏', '夕阳', '日落', '傍晚', '晚霞', '落日', '暮色', '余晖'], { timeOfDay: 'dusk' }],
  [['深夜', '午夜', '半夜', '夜深', '夜晚'], { timeOfDay: 'night' }],
  [['孤独', '寂寞', '思念', '想念', '怀念', '离别', '悲伤', '难过', '伤心', '失落', '想家', '秋'], { palette: 'melancholy' }],
  [['温暖', '开心', '快乐', '幸福', '喜欢', '爱', '甜', '暖', '热闹', '欢喜', '团圆', '春'], { palette: 'warm' }],
  [['安静', '宁静', '平静', '静', '睡', '休息', '放松', '清凉'], { palette: 'serene', wind: 0.05 }],
  [['狂风', '大风', '刮风', '风大'], { wind: 0.9 }],
  [['微风', '清风', '风'], { wind: 0.45 }],
  [['无风', '风停', '水平如镜', '镜子'], { wind: 0 }],
];

// Words about the fish (or anyone) wanting something. The first rule that
// matches wins; a negated match ("不想出去") is skipped.
const FISH_RULES: [words: string[], intent: FishIntent][] = [
  [['外面的世界', '看看外面', '远方', '远处', '探索', '出去', '去看看', '旅行', '冒险', '游远', '走走'], 'explore'],
  [['在一起', '一起', '团聚', '团圆', '相聚', '陪伴', '陪着', '陪', '聚', '拥抱', '朋友', '家人'], 'gather'],
  [['睡觉', '睡吧', '睡', '休息', '歇', '累了', '做梦', '梦', '晚安'], 'rest'],
  [['跳舞', '跳', '玩耍', '玩', '嬉戏', '调皮', '欢腾', '闹', '撒欢'], 'play'],
];

// "不要下雨" should not start rain; it simply cancels that rule.
const NEGATIONS = ['不要', '不想', '别', '不', '没有', '停'];

const BRIGHT = ['美好', '真好', '很好', '好美', '笑', '光', '亮', '希望', '自由', '喜', '乐', '明', '花', '阳光', '温柔', '期待', '轻松', '舒服', '可爱', '晴朗'];
const LOW = ['累', '哭', '泪', '痛', '苦', '愁', '冷', '黑', '暗', '丢', '失', '烦', '怕', '孤', '遗憾', '叹', '寒', '凉', '老', '远'];

const MOOD_COMMAND: Record<Mood, SceneCommand> = {
  bright: { palette: 'warm', intensity: 0.6 },
  low: { palette: 'melancholy', intensity: 0.6 },
  calm: { palette: 'serene', wind: 0.15, intensity: 0.4 },
};

export function interpret(input: string): Interpretation {
  const text = input.trim().slice(0, 50);
  const command: SceneCommand = {};
  let hit = false;
  let consumed = text;
  // 月夜下雪: the snow rule comes first and takes the weather; moonlight in
  // the same words then joins it rather than being dropped.
  let moonHit = false;

  for (const [words, set] of KEYWORDS) {
    for (const w of words) {
      const at = consumed.indexOf(w);
      if (at < 0) continue;
      // Blank out what matched so a shorter word in a later rule cannot hit it again.
      consumed = consumed.slice(0, at) + '　'.repeat(w.length) + consumed.slice(at + w.length);
      if (negated(text, at)) {
        if (set.weather && set.weather !== 'clear') {
          command.weather = 'clear';
          hit = true;
        }
        break;
      }
      if (set.weather === 'moonlit') moonHit = true;
      for (const [k, v] of Object.entries(set) as [keyof SceneCommand, never][]) {
        if (command[k] === undefined) command[k] = v;
      }
      hit = true;
      break;
    }
  }

  if (command.weather === 'snow' && moonHit) command.weather = 'moonsnow';

  for (const [words, intent] of FISH_RULES) {
    const w = words.find((x) => text.includes(x) && !negated(text, text.indexOf(x)));
    if (!w) continue;
    command.fish = intent;
    hit = true;
    break;
  }

  // A palette a keyword chose says more about the mood than counting words.
  const mood: Mood = command.palette === 'melancholy' ? 'low' : command.palette === 'warm' ? 'bright' : moodOf(text);
  if (!hit) return { command: { ...MOOD_COMMAND[mood] }, source: 'sentiment', mood };
  if (command.intensity === undefined) command.intensity = mood === 'calm' ? 0.5 : 0.7;
  return { command, source: 'keyword', mood };
}

export function moodOf(text: string): Mood {
  let score = 0;
  for (const w of BRIGHT) if (text.includes(w) && !negated(text, text.indexOf(w))) score++;
  for (const w of LOW) if (text.includes(w)) score--;
  if (score > 0) return 'bright';
  if (score < 0) return 'low';
  return 'calm';
}

function negated(text: string, at: number): boolean {
  const before = text.slice(Math.max(0, at - 3), at);
  return NEGATIONS.some((n) => before.endsWith(n) || before.slice(0, -1).endsWith(n));
}

/**
 * Validate an untrusted scene command (from the AI) field by field: unknown
 * fields and values outside the enums are dropped, numbers are clamped
 * (docs/02 §5.3).
 */
export function validateCommand(raw: unknown): SceneCommand {
  const out: SceneCommand = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  if (r.timeOfDay === 'night' || r.timeOfDay === 'dusk') out.timeOfDay = r.timeOfDay;
  if (WEATHERS.includes(r.weather as Weather)) out.weather = r.weather as Weather;
  if (r.palette === 'serene' || r.palette === 'warm' || r.palette === 'melancholy') out.palette = r.palette;
  for (const k of ['wind', 'intensity'] as const) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(Math.max(v, 0), 1);
  }
  if (FISH_INTENTS.includes(r.fish as FishIntent)) out.fish = r.fish as FishIntent;
  return out;
}

/**
 * Merge a late AI command into what the local rules already did. Fields a
 * keyword set are kept (no rain turning into snow a moment later); fields
 * the sentiment fallback only guessed may be refined, and so may intensity.
 */
export function mergeAi(local: Interpretation, ai: SceneCommand): SceneCommand {
  const out: SceneCommand = {};
  const locked = local.source === 'keyword' ? local.command : {};
  for (const k of ['timeOfDay', 'weather', 'palette', 'wind', 'fish'] as const) {
    if (ai[k] !== undefined && locked[k] === undefined && ai[k] !== local.command[k]) (out as Record<string, unknown>)[k] = ai[k];
  }
  if (ai.intensity !== undefined) out.intensity = ai.intensity;
  return out;
}
