import { CHARACTERS, type CharacterId } from './content';
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
