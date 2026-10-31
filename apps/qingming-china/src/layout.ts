import { CHARACTERS, ENVIRONMENT, type CharacterId } from './content';
import type { GameState } from './game';

// The story stretch (Codex's river painting, 3:1) keeps its own coordinates,
// 0–3600 × 1200, for art, feet, camera and hit areas. The long scroll extends it
// on both sides: local x runs from ROLL_MIN (the city's quiet west end) to
// ROLL_MAX (the countryside where the scroll begins). Saves hold ids, never x.
export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 1200;
export const PERSON_HEIGHT = WORLD_HEIGHT * 90 / 700;
export const ORIGIN = 10800;
export const ROLL_WIDTH = 24000;
export const ROLL_MIN = -ORIGIN;
export const ROLL_MAX = ROLL_WIDTH - ORIGIN;
/** The roll is cut into tiles of this width (1024 px each), loaded near the camera. */
export const TILE = 1200;
export const TILES = ROLL_WIDTH / TILE;

/** Places along the roll, right to left as the scroll is read; local x. */
export const REGIONS = [
  { id: 'ferry', from: 12000, to: ROLL_MAX, area: '卷首', place: '野渡 · 春水' },
  { id: 'fields', from: 10800, to: 12000, area: '城东郊外', place: '麦田 · 渡船' },
  { id: 'village', from: 9600, to: 10800, area: '城东郊外', place: '村口 · 柳道' },
  { id: 'mill', from: 8400, to: 9600, area: '汴河上游', place: '水磨 · 竹林' },
  { id: 'inn', from: 7200, to: 8400, area: '汴河上游', place: '河畔客店' },
  { id: 'boatyard', from: 6000, to: 7200, area: '汴河上游', place: '船坞 · 木作' },
  { id: 'harbor', from: 4800, to: 6000, area: '汴河上游', place: '货港 · 粮船' },
  { id: 'landing', from: 3600, to: 4800, area: '河东', place: '水埠 · 浣衣' },
  { id: 'paper', from: 2650, to: 3600, area: '河东', place: '柳家纸铺' },
  { id: 'tea', from: 1800, to: 2650, area: '桥畔', place: '何记茶坊' },
  { id: 'bridge', from: 0, to: 1800, area: '虹桥', place: '汴河渡口' },
  { id: 'stalls', from: -1200, to: 0, area: '桥西', place: '桥头 · 摊棚' },
  { id: 'restaurant', from: -2400, to: -1200, area: '桥西', place: '河畔正店' },
  { id: 'workshop', from: -3600, to: -2400, area: '桥西', place: '染坊 · 木作' },
  { id: 'road', from: -4800, to: -3600, area: '城外', place: '大道 · 车马' },
  { id: 'gate', from: -6000, to: -4800, area: '城门', place: '驼队入城' },
  { id: 'shops', from: -7200, to: -6000, area: '城内', place: '市肆' },
  { id: 'temple', from: -8400, to: -7200, area: '城内', place: '寺前 · 井台' },
  { id: 'lanes', from: ROLL_MIN, to: -8400, area: '城内', place: '静巷 · 小河' },
] as const;
export type SceneId = typeof REGIONS[number]['id'];
export const regionAt = (x: number) => REGIONS.find(r => x >= r.from && x < r.to) ?? (x < 0 ? REGIONS[REGIONS.length - 1] : REGIONS[0]);
export const sceneAt = (x: number): SceneId => regionAt(x).id;

/** The chapter buttons, left to right on screen. */
export const CHAPTERS = [
  { id: 'gate', name: '城门', x: -5400 },
  { id: 'bridge', name: '虹桥', x: 1390 },
  { id: 'tea', name: '茶坊', x: 2260 },
  { id: 'paper', name: '纸铺', x: 2940 },
  { id: 'harbor', name: '货港', x: 5400 },
  { id: 'fields', name: '乡野', x: 11400 },
] as const;
export type ChapterId = typeof CHAPTERS[number]['id'];
export const SCENE_CENTER = Object.fromEntries(CHAPTERS.map(c => [c.id, c.x])) as Record<ChapterId, number>;

export function personPosition(id: CharacterId, game: GameState) {
  return id === 'cheng' && game.progress.route === 'deliver'
    ? { x: 2320, y: 797 } : CHARACTERS[id];
}

export function personPose(id: CharacterId, game: GameState): 0 | 1 | 2 {
  const { quests, tea, route, favorite } = game.progress;
  if (id === 'liu') return quests.paper.step === 2 ? 2 : quests.paper.step === 0 ? 1 : 0;
  if (id === 'zhou') return quests.boat.step === 3 ? 2 : quests.boat.step > 0 ? 1 : 0;
  if (id === 'cheng') return route === 'deliver' || quests.boat.step === 2 ? 1 : 0;
  if (id === 'he') return tea ? 2 : 1;
  if (id === 'chen') return quests.purse.step === 4 ? 2 : quests.purse.step > 0 ? 1 : 0;
  return favorite ? 1 : 0;
}

export type HitTarget = { kind: 'person'; id: CharacterId } | { kind: 'environment'; id: string };

/**
 * Where hotspots overlap (the cat beside 陈生, the tea stove beside 何娘), a tap
 * goes to the target whose anchor is nearest the tap, not to whichever button
 * is on top. Rects match ScrollView's buttons: at least 48 CSS px either way.
 */
export function pickHotspot(x: number, y: number, game: GameState, scale: number): HitTarget | null {
  const min = 48 / scale;
  const found: { t: HitTarget; d: number }[] = [];
  for (const id of Object.keys(CHARACTERS) as CharacterId[]) {
    const p = personPosition(id, game);
    const cy = p.y - PERSON_HEIGHT * .48;
    const w = Math.max(min, PERSON_HEIGHT * .64), h = Math.max(min, PERSON_HEIGHT);
    if (Math.abs(x - p.x) <= w / 2 && Math.abs(y - cy) <= h / 2) found.push({ t: { kind: 'person', id }, d: Math.hypot(x - p.x, y - cy) });
  }
  for (const env of ENVIRONMENT) {
    if (Math.abs(x - env.x) <= min / 2 && Math.abs(y - env.y) <= min / 2) found.push({ t: { kind: 'environment', id: env.id }, d: Math.hypot(x - env.x, y - env.y) });
  }
  found.sort((a, b) => a.d - b.d);
  return found[0]?.t ?? null;
}
