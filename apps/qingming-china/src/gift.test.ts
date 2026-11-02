import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GIFT_KINDS, GIFT_LINES, wrapNote } from './content/gift';
import { PAGES } from './content';
import { GiftPaper, giftPaperData, type GiftPaperData } from './GiftPaper';
import { giftWorkLink } from './giftExport';

describe('gift paper content and disclosure boundaries',()=>{
  it('aligns four kinds with Edo and provides sixteen original, distinct short notes',()=>{
    expect(GIFT_KINDS.map(kind=>kind.id)).toEqual(['shimijimi','kangaeru','hotto','soba']);
    expect(GIFT_KINDS.map(kind=>kind.lines.length)).toEqual([4,4,4,4]);expect(new Set(GIFT_LINES).size).toBe(16);
    for(const note of GIFT_LINES){
      const lines=wrapNote(note,18);expect(lines.length).toBeLessThanOrEqual(2);expect(lines.join('')).toBe(note);
      for(const line of lines){expect([...line].length).toBeLessThanOrEqual(19);expect(line).not.toMatch(/^[，。！？、]+$/);}
    }
  });
  it('keeps gifts free of progress, money and privately supplied fields across every page',()=>{
    for(const page of PAGES){
      const data={...giftPaperData(page.id,GIFT_LINES[0]),wallet:987654,completed:'private-task-total'} as GiftPaperData;
      const image=renderToStaticMarkup(createElement(GiftPaper,{data}));const words=image.replace(/<[^>]*>/g,'');
      expect(words).toContain(page.title);expect(words).toContain(GIFT_LINES[0]);
      expect(image).not.toMatch(/987654|private-task-total/);expect(words).not.toMatch(/[0-9０-９]|任务|余额|文钱|奖励|今日记下|段相遇|已完成/);
    }
  });
  it('rejects unreviewed text and unknown pages rather than displaying arbitrary content',()=>{
    expect(()=>giftPaperData('paper-hands','not-reviewed')).toThrow();
    expect(()=>giftPaperData('foreign-page' as never,GIFT_LINES[0])).toThrow();
    expect(giftPaperData('paper-hands',GIFT_LINES[0],{private:'value'} as never).close).toBe(false);
  });
  it('uses painted source art for the first J02 composition without mounting the live world',()=>{
    const image=renderToStaticMarkup(createElement(GiftPaper,{data:giftPaperData('paper-hands',GIFT_LINES[0],true)}));
    expect(image).toContain('scroll-11.webp');expect(image).toContain('characters-v1.webp');expect(image).toContain('props-v1.webp');
    expect(image).toContain('2760 640 360 225');expect(image).not.toMatch(/foreignObject|<canvas|watermill/);
  });
  it('shares only the work and a known scene at both mount paths, dropping private queries and hashes',()=>{
    for(const base of ['/','/qingming/'])for(const page of PAGES){
      const url=new URL(giftWorkLink('https://want.world/edo/?email=private&session=1#secret',base,page.id));
      expect(url.pathname).toBe(base);expect([...url.searchParams.keys()]).toEqual(['scene']);expect(url.hash).toBe('');
      expect(['paper','bridge','tea','harbor','gate','fields']).toContain(url.searchParams.get('scene'));expect(url.toString()).not.toMatch(/private|secret|session/);
    }
  });
});
