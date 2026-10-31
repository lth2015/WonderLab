import { CHARACTERS, ENVIRONMENT, type CharacterId } from './content';
import type { GameState } from './game';

// The painting is 3:1. Keep one coordinate system for art, feet, camera and hit areas.
export const WORLD_WIDTH = 3600;
export const WORLD_HEIGHT = 1200;
export const PERSON_HEIGHT = WORLD_HEIGHT * 90 / 700;
export const CHAPTERS = [
  { id: 'bridge', name: '虹桥', x: 1390 },
  { id: 'tea', name: '茶坊', x: 2260 },
  { id: 'paper', name: '纸铺', x: 2940 },
] as const;
export type SceneId = typeof CHAPTERS[number]['id'];
export const SCENE_CENTER = Object.fromEntries(CHAPTERS.map(c => [c.id, c.x])) as Record<SceneId, number>;
export const sceneAt = (x: number): SceneId => x < 1800 ? 'bridge' : x < 2650 ? 'tea' : 'paper';

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
