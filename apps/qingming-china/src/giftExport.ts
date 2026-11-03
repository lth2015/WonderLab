import type { PageId } from './content';

const images = new Map<string, Promise<string>>();
function inlineImage(href: string): Promise<string> {
  let pending=images.get(href);
  if(!pending){
    pending=fetch(href).then(response=>{if(!response.ok)throw new Error('画页素材未能载入。');return response.blob();}).then(blob=>new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('画页素材未能读取。'));reader.readAsDataURL(blob);
    }));
    images.set(href,pending);
    void pending.catch(()=>{if(images.get(href)===pending)images.delete(href);});
    if(images.size>8)images.delete(images.keys().next().value!);
  }
  return pending;
}

/** Snapshot first, then inline every image: a serialized SVG cannot fetch linked images. */
export async function giftToPng(svg: SVGSVGElement): Promise<Blob> {
  const copy=svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width','1440');copy.setAttribute('height','1800');
  await document.fonts?.ready;
  await Promise.all([...copy.querySelectorAll('image')].map(async image=>{
    const href=image.getAttribute('href')??image.getAttribute('xlink:href');
    if(href&&!href.startsWith('data:'))image.setAttribute('href',await inlineImage(href));
  }));
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('画纸未能装裱，请再试一次。'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1800;
    try {
      const context=canvas.getContext('2d');if(!context)throw new Error('浏览器暂不能生成画纸。');
      context.drawImage(image,0,0,1440,1800);
      return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画纸未能保存，请再试一次。')),'image/png'));
    }finally{canvas.width=0;canvas.height=0;}
  }finally{URL.revokeObjectURL(url);}
}

const SCENES: Record<PageId,string> = {
  'paper-hands':'paper','paper-boats':'paper','paper-bridge':'paper','river-team':'bridge','river-delivery':'tea',
  'tea-seat':'tea',purse:'tea',bridge:'bridge',willow:'paper',market:'tea',master:'paper',departure:'bridge',
  'harbor-space':'harbor','gate-meeting':'gate','ferry-neighbor':'fields','willow-trace':'paper','paper-breeze':'paper',
};
/** New URL from the work's base, never the current query/hash or save data. */
export function giftWorkLink(origin: string, base: string, page: PageId): string {
  const url=new URL(base,origin);url.searchParams.set('scene',SCENES[page]);return url.toString();
}
