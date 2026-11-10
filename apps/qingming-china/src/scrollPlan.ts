import { TILE, TILES, WORLD_HEIGHT } from './layout';

export type ScrollMode = 'phone' | 'full';
export const SOURCE_TILE_PIXELS=1024;
export const SCROLL_END=240;
export type ScrollPlan = { tiles:number[]; head:boolean; tail:boolean; tilePixels:number; endPixels:number; width:number; height:number };
/** Pictures are saved from the right (卷首) to the left (卷尾); tiles are never mirrored. */
export function scrollPlan(mode:ScrollMode):ScrollPlan[] {
  const order=Array.from({length:TILES},(_,i)=>TILES-1-i);
  const height=mode==='phone'?700:SOURCE_TILE_PIXELS;
  const tilePixels=Math.round(TILE/WORLD_HEIGHT*height),endPixels=Math.round(SCROLL_END/WORLD_HEIGHT*height);
  const size=mode==='phone'?TILES:Math.ceil(TILES/4),groups:number[][]=[];
  for(let i=0;i<TILES;i+=size)groups.push(order.slice(i,i+size));
  return groups.map((tiles,i)=>({tiles,head:i===0,tail:i===groups.length-1,tilePixels,endPixels,height,
    width:tiles.length*tilePixels+(i===0?endPixels:0)+(i===groups.length-1?endPixels:0)}));
}
