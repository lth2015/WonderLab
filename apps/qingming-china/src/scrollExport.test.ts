import { describe, expect, it } from 'vitest';
import { initialState, reduceGame } from './game';
import { scrollPlan, SOURCE_TILE_PIXELS } from './scrollPlan';
import { tileMarkup } from './scrollExport';

describe('source-composed scroll pictures',()=>{
  it('covers every tile once, starting at the right, and keeps each picture within phone canvas limits',()=>{
    for(const mode of ['phone','full'] as const){
      const parts=scrollPlan(mode);
      expect(parts.flatMap(part=>part.tiles)).toEqual(Array.from({length:20},(_,i)=>19-i));
      expect(parts.filter(part=>part.head)).toHaveLength(1);expect(parts[0].head).toBe(true);
      expect(parts.filter(part=>part.tail)).toHaveLength(1);expect(parts.at(-1)!.tail).toBe(true);
      for(const part of parts){expect(part.width*part.height).toBeLessThan(16777216);expect(part.width).toBeLessThan(16384);}
    }
    expect(scrollPlan('phone').map(p=>[p.width,p.height])).toEqual([[14280,700]]);
    expect(scrollPlan('full').map(p=>[p.width,p.height])).toEqual([[5325,1024],[5120,1024],[5120,1024],[5325,1024]]);
    expect(scrollPlan('full').every(p=>p.tilePixels===SOURCE_TILE_PIXELS)).toBe(true);
  });
  it('renders every tile without mounting any browser-only wheel or reading a live view',()=>{
    const game=initialState();game.wallet=987654321;
    for(let tile=0;tile<20;tile++){
      const picture=tileMarkup(tile,game);
      expect(picture).toContain(`scroll-${String(tile).padStart(2,'0')}.webp`);
      expect(picture).not.toMatch(/foreignObject|<canvas|person-idle|walk-route|987654321|今日记下|已完成|余额/);
      const text=picture.replace(/<[^>]*>/g,'');expect(['','笺纸']).toContain(text);
      if(tile<9||tile>12)expect(picture).not.toContain('characters-v1.webp');
    }
    const mill=tileMarkup(16,game);expect(mill).toContain('buckets-v2.webp');expect(mill).toContain('face-v2.webp');
    expect(mill).toContain('viewBox="0 0 180 284"');
  });
  it('uses the snapshot story poses and delivered cargo without changing progress or rewards',()=>{
    const game=initialState();const before=JSON.stringify(game),first=tileMarkup(10,game);
    expect(JSON.stringify(game)).toBe(before);
    const next=reduceGame(reduceGame(game,{type:'PRESS_PAPER'}),{type:'SKETCH',view:'hands',close:false,decoration:'春日小记'});
    next.progress.route='deliver';next.progress.quests.boat={status:'complete',step:3};
    const delivered=tileMarkup(10,next),paper=tileMarkup(11,next);
    expect(delivered).toContain('translate(2320 797)');expect(delivered).not.toBe(first);
    expect(paper).toContain('data-character="liu" data-pose="2"');expect(JSON.stringify(game)).toBe(before);
  });
});
