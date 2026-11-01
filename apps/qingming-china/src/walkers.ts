import type { CharacterId } from './content';

export type Walker = { id: CharacterId; x: number; y: number; height: number; flip?: boolean };
// Feet are measured on the painted deck; the arch silhouette is below the floor.
export const BRIDGE_WALKERS: Walker[] = [
  { id: 'cheng', x: 135, y: 467, height: 120 }, { id: 'chen', x: 340, y: 405, height: 121, flip: true },
  { id: 'he', x: 510, y: 359, height: 120 }, { id: 'zhou', x: 710, y: 331, height: 120 },
  { id: 'shen', x: 904, y: 335, height: 123, flip: true }, { id: 'liu', x: 1100, y: 382, height: 124 },
  { id: 'chen', x: 1310, y: 463, height: 124 },
];
export const QUAY_WALKERS: Walker[] = [
  { id: 'he', x: 1715, y: 570, height: 100 },
  { id: 'shen', x: 1980, y: 642, height: 106, flip: true }, { id: 'cheng', x: 2110, y: 628, height: 101 },
  { id: 'liu', x: 2460, y: 655, height: 102 }, { id: 'zhou', x: 2650, y: 745, height: 113, flip: true },
  { id: 'he', x: 3090, y: 852, height: 112 }, { id: 'cheng', x: 3500, y: 901, height: 112 },
];
export const WALKERS = [...BRIDGE_WALKERS, ...QUAY_WALKERS];
