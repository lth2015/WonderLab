import { PAGES, type PageId } from './content';
import type { GameState } from './game';

export function downloadFile(blob: Blob, name: string) {
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line=52) {
  let row='';let yy=y;
  for(const char of text){if(ctx.measureText(row+char).width>max){ctx.fillText(row,x,yy);row='';yy+=line;}row+=char;}
  if(row)ctx.fillText(row,x,yy);return yy;
}
export async function exportPostcard(game: GameState, id: PageId, art: SVGSVGElement | null) {
  const page=PAGES.find(p=>p.id===id)!;
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1800;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器暂不能生成留念图片。');
  ctx.fillStyle='#ede5d0';ctx.fillRect(0,0,1440,1800);
  ctx.strokeStyle='#b3a78a';ctx.lineWidth=2;ctx.strokeRect(56,56,1328,1688);ctx.strokeRect(68,68,1304,1664);
  ctx.fillStyle='#6f7663';ctx.font='26px serif';ctx.fillText('清 明 上 河 图  ·  汴 河 拾 光',120,145);
  if(art){
    const svg=art.cloneNode(true) as SVGSVGElement;svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','1200');svg.setAttribute('height','750');svg.style.color=page.color;const design=game.progress.designs[id];if(design?.close)svg.setAttribute('viewBox','55 40 210 131.25');
    const data=new XMLSerializer().serializeToString(svg);const url=URL.createObjectURL(new Blob([data],{type:'image/svg+xml'}));
    try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('画页绘制失败，请重试。'));image.src=url;});ctx.drawImage(image,120,220,1200,750);}finally{URL.revokeObjectURL(url);}
  }
  ctx.fillStyle='#404a3e';ctx.font='76px serif';ctx.fillText(page.title,120,1100);
  ctx.font='28px serif';ctx.fillStyle='#92846b';ctx.fillText((game.progress.designs[id]?.decoration??page.subtitle)+'  /  原创故事画页',124,1170);
  ctx.font='36px serif';ctx.fillStyle='#5e6554';wrapText(ctx,page.caption,124,1280,1180,65);
  ctx.fillStyle='#a34e3c';ctx.fillRect(120,1555,75,92);ctx.fillStyle='#f1e6ce';ctx.font='30px serif';ctx.fillText('拾',142,1590);ctx.fillText('光',142,1627);
  ctx.fillStyle='#8b826b';ctx.font='26px serif';ctx.fillText(`今日记下 ${game.journal.length} 页 · ${game.claimed.length} 段相遇`,230,1610);
  ctx.font='23px serif';ctx.fillText('一河烟火，众人相成。',230,1652);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('保存图片失败，请重试。')),'image/png'));
  downloadFile(blob,`汴河拾光-${page.title}.png`);
}
