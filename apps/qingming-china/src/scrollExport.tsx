import { renderToStaticMarkup } from 'react-dom/server';
import { PaintedLandscape } from './PaintedArt';
import type { GameState } from './game';
import { ORIGIN, TILE, TILES, WORLD_HEIGHT } from './layout';
import { scrollPlan, type ScrollMode } from './scrollPlan';

export type ScrollPart={name:string;blob:Blob;width:number;height:number};
const PAPER='#ede5d0';
function check(signal?:AbortSignal) {if(signal?.aborted)throw new DOMException('已取消制作','AbortError');}
function abortable<T>(pending:PromiseLike<T>,signal?:AbortSignal):Promise<T> {
  check(signal);
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(new DOMException('已取消制作','AbortError'));
    signal?.addEventListener('abort',cancel,{once:true});
    Promise.resolve(pending).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',cancel));
  });
}
async function assetData(href:string,cache:Map<string,Promise<string>>,signal?:AbortSignal) {
  let value=cache.get(href);
  if(!value){
    value=fetch(href,{signal}).then(response=>{if(!response.ok)throw new Error('有一处画卷素材未能载入，请重试。');return response.blob();}).then(blob=>new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('画卷素材未能读取，请重试。'));reader.readAsDataURL(blob);
    }));
    cache.set(href,value);
  }
  return abortable(value,signal);
}
/** An independent source composition, never a clone of the live DOM or its canvas. */
export function tileMarkup(tile:number,state:GameState):string {
  return renderToStaticMarkup(<PaintedLandscape state={state} feedback={null} center={tile*TILE-ORIGIN+TILE/2} viewHalf={TILE/2} stillTile={tile}/>);
}
async function tileImage(tile:number,state:GameState,pixels:number,cache:Map<string,Promise<string>>,signal?:AbortSignal) {
  check(signal);
  const svg=new DOMParser().parseFromString(tileMarkup(tile,state),'image/svg+xml').documentElement;
  svg.setAttribute('width',String(pixels));svg.setAttribute('height',String(pixels));
  // Runtime classes never enter a picture, even if future animation rules change.
  for(const node of [svg,...svg.querySelectorAll('*')]){node.removeAttribute('class');node.removeAttribute('style');}
  await Promise.all([...svg.querySelectorAll('image')].map(async node=>{
    const href=node.getAttribute('href');if(href)node.setAttribute('href',await assetData(href,cache,signal));
  }));
  check(signal);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
  const image=new Image();image.decoding='async';
  try{
    await abortable(new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('这一段画卷未能装裱，请重试。'));image.src=url;}),signal);
    return image;
  }catch(error){image.src='';throw error;}
  finally{image.onload=null;image.onerror=null;URL.revokeObjectURL(url);}
}
function vertical(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,size:number) {
  ctx.font=`${size}px 'Songti SC','STSong','SimSun',serif`;ctx.textAlign='center';ctx.textBaseline='top';
  [...text].forEach((char,i)=>ctx.fillText(char,x,y+i*size*1.18));
}
function endPaper(ctx:CanvasRenderingContext2D,x:number,width:number,height:number,head:boolean) {
  const scale=height/WORLD_HEIGHT;
  ctx.fillStyle=PAPER;ctx.fillRect(x,0,width,height);ctx.fillStyle='#616c53';
  if(head){
    ctx.fillStyle='#f5eddb';ctx.fillRect(x+width*.28,70*scale,width*.44,300*scale);
    ctx.strokeStyle='#a79877';ctx.lineWidth=scale;ctx.strokeRect(x+width*.28,70*scale,width*.44,300*scale);
    ctx.fillStyle='#53604b';vertical(ctx,'汴河拾光',x+width/2,100*scale,42*scale);
    vertical(ctx,'清明上河图 · 中国篇',x+width/2,430*scale,20*scale);
  }else{
    vertical(ctx,'一河烟火，众人相成。',x+width*.62,250*scale,24*scale);
    vertical(ctx,'原创绘卷 · 取意清明上河图',x+width*.36,250*scale,16*scale);
  }
}
/** Bounded canvases, per-job image cache, current story state frozen at the start. */
export async function exportScroll(mode:ScrollMode,game:GameState,onProgress:(done:number,total:number)=>void,signal?:AbortSignal):Promise<ScrollPart[]> {
  check(signal);
  const snapshot=JSON.parse(JSON.stringify(game)) as GameState;
  const cache=new Map<string,Promise<string>>(),parts:ScrollPart[]=[];
  let done=0;
  onProgress(0,TILES);
  try{
    await abortable(document.fonts.ready,signal);
    const plan=scrollPlan(mode);
    for(const [index,part] of plan.entries()){
      check(signal);
      const canvas=document.createElement('canvas');canvas.width=part.width;canvas.height=part.height;
      try{
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('这台设备暂不能装裱图片。可以重试或改用分张。');
        ctx.fillStyle=PAPER;ctx.fillRect(0,0,part.width,part.height);
        let right=part.width-(part.head?part.endPixels:0);
        if(part.head)endPaper(ctx,right,part.endPixels,part.height,true);
        for(const tile of part.tiles){
          const image=await tileImage(tile,snapshot,part.tilePixels,cache,signal);
          try{check(signal);right-=part.tilePixels;ctx.drawImage(image,right,0,part.tilePixels,part.height);}
          finally{image.src='';}
          onProgress(++done,TILES);
          await abortable(new Promise<void>(resolve=>setTimeout(resolve,0)),signal);
        }
        if(part.tail)endPaper(ctx,0,part.endPixels,part.height,false);
        const blob=await abortable(new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.92)),signal);
        check(signal);if(!blob)throw new Error('图片没能保存。可以重试，或改用分张制作。');
        parts.push({name:plan.length===1?'汴河拾光-长卷.jpg':`汴河拾光-长卷-${index+1}of${plan.length}.jpg`,blob,width:part.width,height:part.height});
      }finally{canvas.width=0;canvas.height=0;}
    }
    return parts;
  }finally{cache.clear();}
}
