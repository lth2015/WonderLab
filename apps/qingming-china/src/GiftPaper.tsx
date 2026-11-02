import type { Ref } from 'react';
import { PAGES, CHARACTERS, type PageId } from './content';
import { JournalArt } from './Art';
import { PaintedPerson, PaintedProp } from './PaintedArt';
import { PERSON_HEIGHT } from './layout';
import { GIFT_LINES, wrapNote } from './content/gift';

export type GiftPaperData = { pageId: PageId; note: string; close: boolean };
/** Only presentation choices enter a gift: no wallet, task counts or saved progress. */
export function giftPaperData(pageId: PageId, note: string, close=false): GiftPaperData {
  if(!PAGES.some(page=>page.id===pageId)||!GIFT_LINES.includes(note))throw new Error('请选择画册中的风景与一句赠言。');
  return{pageId,note,close:close===true};
}

export function GiftScene({ data }: { data: GiftPaperData }) {
  const page=PAGES.find(page=>page.id===data.pageId)!;
  if(data.pageId==='paper-hands'){
    const view=data.close?'2760 640 360 225':'2670 485 690 431.25';
    return <svg x={120} y={220} width={1200} height={750} viewBox={view} overflow="hidden" data-scene-art="painted-paper">
      <image href={`${import.meta.env.BASE_URL}art/china/scroll/scroll-11.webp`} x={2400} y={0} width={1201} height={1200} preserveAspectRatio="none"/>
      <PaintedProp kind="paper" x={2928} y={843} width={55}/>
      <PaintedPerson id="liu" x={CHARACTERS.liu.x} y={CHARACTERS.liu.y} height={PERSON_HEIGHT} pose={1}/>
    </svg>;
  }
  return <svg x={120} y={220} width={1200} height={750} viewBox={data.close?'55 40 210 131.25':'0 0 320 200'} overflow="hidden">
    <svg x={0} y={0} width={320} height={200} viewBox="0 0 320 200"><JournalArt kind={page.art} color={page.color}/></svg>
  </svg>;
}

/** This exact SVG is used to create the preview bitmap and the saved/shared PNG. */
export function GiftPaper({ data, artRef }: { data: GiftPaperData; artRef?: Ref<SVGSVGElement> }) {
  const page=PAGES.find(page=>page.id===data.pageId)!;
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1800" width={1440} height={1800}
    ref={artRef} role="img" aria-label={`《${page.title}》：${data.note}`} fontFamily="'Songti SC','STSong','SimSun',serif">
    <rect width={1440} height={1800} fill="#ede5d0"/>
    <rect x={56} y={56} width={1328} height={1688} fill="none" stroke="#b3a78a" strokeWidth={2}/>
    <rect x={68} y={68} width={1304} height={1664} fill="none" stroke="#b3a78a" strokeWidth={1.5}/>
    <text x={120} y={145} fill="#6f7663" fontSize={30} letterSpacing={7}>清明上河图 · 汴河拾光</text>
    <GiftScene data={data}/>
    <text x={120} y={1100} fill="#404a3e" fontSize={76}>{page.title}</text>
    <text x={124} y={1170} fill="#92846b" fontSize={28} letterSpacing={3}>一页风景 · 寄给你</text>
    {wrapNote(data.note,18).map((line,i)=><text key={i} x={124} y={1285+i*95} fill="#4f5b48" fontSize={62}>{line}</text>)}
    <rect x={120} y={1555} width={75} height={92} fill="#a34e3c"/>
    <text x={142} y={1590} fill="#f1e6ce" fontSize={30}>拾</text><text x={142} y={1627} fill="#f1e6ce" fontSize={30}>光</text>
    <text x={230} y={1612} fill="#8b826b" fontSize={26}>一河烟火，众人相成。</text>
  </svg>;
}
