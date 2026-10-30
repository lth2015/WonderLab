// 四时册页 and scene links (the owner, 2026-10-30: 「整个世界的入口在哪？那么多场
// 景别人怎么知道呢？」). Every scene the world has, as a page in a book, by the
// seasons and the hours, and as an address: want.world/柳 opens straight into
// it, the visitor's own lake and fish still there. Entering a scene says its
// line, as if the visitor had written it (so the echo and the rules are the
// same as for typed words); the time of day is set first where the line does
// not say it. Lines, order and paintings are Codex's (collab
// docs/handoff/codex-entrance.md, art-incoming/book/pages.json). Pure, so the
// lines are checked against the scenes they must bring (scenes.test.ts).

import type { TimeOfDay, Weather } from './engine/intent';

export type Season = '春' | '夏' | '秋' | '冬';

export interface Scene {
  /** For the address: want.world/<id> or want.world/<name>. */
  id: string;
  /** Its name, short enough to be an address. */
  name: string;
  /** What is said on entering (shown on the page). */
  line: string;
  season: Season;
  /** The weather the line must bring. */
  weather: Weather;
  /** Set before the line, when the line does not set it itself. */
  time?: TimeOfDay;
  /** The picture with the willow (?shore=willow). */
  willow?: boolean;
  /** What the page is named for, brought about soon after entering so it is met, not only implied. */
  moment?: 'magpie' | 'cicada';
  /** Codex's painting for the page, public/art/book/<id>.webp (until then a wash of its hour). */
  art?: boolean;
}

export const SCENES: readonly Scene[] = [
  { id: 'willow', name: '柳', line: '晴光入柳，风过水明', season: '春', weather: 'clear', time: 'day', willow: true, art: true },
  { id: 'blossom', name: '落花', line: '落花轻点一湖春', season: '春', weather: 'blossom', time: 'day', art: true },
  { id: 'rainbow', name: '虹', line: '雨后初晴，一虹过山', season: '春', weather: 'rainbow', time: 'day', art: true },
  { id: 'lotus', name: '荷', line: '接天莲叶无穷碧', season: '夏', weather: 'lotus', time: 'day', art: true },
  { id: 'storm', name: '雷雨', line: '远山雷雨，近水听声', season: '夏', weather: 'storm' },
  { id: 'magpie', name: '惊鹊', line: '明月别枝惊鹊', season: '夏', weather: 'moonlit', time: 'night', willow: true, moment: 'magpie' },
  { id: 'cicada', name: '鸣蝉', line: '清风半夜鸣蝉', season: '夏', weather: 'fireflies', time: 'night', willow: true, moment: 'cicada' },
  { id: 'fireflies', name: '萤火', line: '夏夜流萤，草间微光', season: '夏', weather: 'fireflies', time: 'night' },
  { id: 'galaxy', name: '星河', line: '满船清梦压星河', season: '夏', weather: 'galaxy', time: 'night' },
  { id: 'autumn', name: '秋', line: '秋风过岸，落叶归水', season: '秋', weather: 'autumn', time: 'dusk' },
  { id: 'moonlit', name: '月', line: '月色入水，清辉满湖', season: '秋', weather: 'moonlit', time: 'night' },
  { id: 'lanterns', name: '河灯', line: '一盏河灯，照见晚水', season: '秋', weather: 'lanterns', time: 'night' },
  { id: 'shower', name: '流星', line: '流星过夜，水接微光', season: '冬', weather: 'shower', time: 'night' },
  { id: 'moonsnow', name: '雪', line: '月下飘雪，山水无声', season: '冬', weather: 'moonsnow', time: 'night' },
];

export const SEASONS: readonly Season[] = ['春', '夏', '秋', '冬'];

/** The scene an address names (want.world/柳, want.world/willow), if any. */
export function sceneFromPath(pathname: string): Scene | null {
  let name: string;
  try {
    name = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, '');
  } catch {
    return null;
  }
  if (!name || name.includes('/')) return null;
  return SCENES.find((s) => s.id === name.toLowerCase() || s.name === name) ?? null;
}

/** The address to share for a scene. */
export function sceneUrl(scene: Scene, origin: string): string {
  return `${origin}/${encodeURIComponent(scene.name)}`;
}

/** 首页随时辰: a first visit sees the hour it is where they are. */
export function timeForHour(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}
