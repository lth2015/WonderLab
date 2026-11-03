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

// The centre of the independently traced bridge floor, in world coordinates.
const bridgeFloor = [[0,505.5],[165.75,457.5],[331.5,407.7],[497.2,359.7],[663,331.5],[795.6,326.5],[928.2,336.5],[1060.8,367.4],[1193.4,412.7],[1326,467.4],[1458.6,522.1]];
export function bridgeFloorY(x: number): number {
  const end=bridgeFloor.findIndex(point=>point[0]>=x);
  if(end<=0)return bridgeFloor[end===0?0:bridgeFloor.length-1][1];
  const [ax,ay]=bridgeFloor[end-1],[bx,by]=bridgeFloor[end];
  return ay+(by-ay)*(x-ax)/(bx-ax);
}
/** A quiet return walk. The middle point keeps changes in the bridge's slope. */
export function walkRoute(walker: Walker, index: number) {
  const bridge=index<BRIDGE_WALKERS.length,range=bridge?46:38;
  const fromX=walker.flip?range:-range,toX=-fromX;
  const quaySlope=[.22,.06,-.03,.12,.12,.05,0][index-BRIDGE_WALKERS.length]??0;
  const dy=(dx:number)=>bridge?bridgeFloorY(walker.x+dx)-bridgeFloorY(walker.x):dx*quaySlope;
  return { fromX,fromY:dy(fromX),toX,toY:dy(toX),seconds:28+index%5*3,delay:-index*2.7 };
}
