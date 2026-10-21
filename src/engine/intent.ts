// 一句成境, local half (docs/02 §5.3): keywords first, then a small
// sentiment dictionary. Pure, so it can be tested and reused when the AI
// result is merged in stage B (local fields win).

export type TimeOfDay = 'night' | 'dusk';
export type Weather = 'clear' | 'rain' | 'mist' | 'fireflies';
export type PaletteName = 'serene' | 'warm' | 'melancholy';

/** The constrained scene command. Every field is optional. */
export interface SceneCommand {
  timeOfDay?: TimeOfDay;
  weather?: Weather;
  palette?: PaletteName;
  wind?: number;      // 0..1
  intensity?: number; // 0..1
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
  [['暴雨', '大雨', '雷雨', '倾盆'], { weather: 'rain', intensity: 0.9, wind: 0.6 }],
  [['下雨', '小雨', '细雨', '春雨', '雨夜', '雨声', '淋雨', '雨'], { weather: 'rain' }],
  [['雾', '朦胧', '迷蒙', '烟波', '云雾', '模糊', '看不清', '雪'], { weather: 'mist' }],
  [['萤火', '流萤', '萤', '夏夜', '夏天', '盛夏', '蝉'], { weather: 'fireflies' }],
  [['晴', '星空', '星星', '满天星', '天亮了', '雨停', '放晴'], { weather: 'clear' }],
  [['黄昏', '夕阳', '日落', '傍晚', '晚霞', '落日', '暮色', '余晖'], { timeOfDay: 'dusk' }],
  [['深夜', '午夜', '半夜', '夜深', '月夜', '夜晚'], { timeOfDay: 'night' }],
  [['孤独', '寂寞', '思念', '想念', '怀念', '离别', '悲伤', '难过', '伤心', '失落', '想家', '秋'], { palette: 'melancholy' }],
  [['温暖', '开心', '快乐', '幸福', '喜欢', '爱', '甜', '暖', '热闹', '欢喜', '团圆', '春'], { palette: 'warm' }],
  [['安静', '宁静', '平静', '静', '睡', '休息', '放松', '清凉'], { palette: 'serene', wind: 0.05 }],
  [['狂风', '大风', '刮风', '风大'], { wind: 0.9 }],
  [['微风', '清风', '风'], { wind: 0.45 }],
  [['无风', '风停', '水平如镜', '镜子'], { wind: 0 }],
];

// "不要下雨" should not start rain; it simply cancels that rule.
const NEGATIONS = ['不要', '不想', '别', '不', '没有', '停'];

const BRIGHT = ['好', '美', '笑', '光', '亮', '希望', '自由', '喜', '乐', '明', '花', '阳光', '温柔', '期待', '轻松', '舒服', '可爱', '晴朗'];
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
      for (const [k, v] of Object.entries(set) as [keyof SceneCommand, never][]) {
        if (command[k] === undefined) command[k] = v;
      }
      hit = true;
      break;
    }
  }

  const mood = moodOf(text);
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
