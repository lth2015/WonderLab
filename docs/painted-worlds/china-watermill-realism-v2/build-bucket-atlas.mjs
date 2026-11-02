import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir=new URL('../../../apps/qingming-china/public/art/china/watermill/',import.meta.url);
const texture='data:image/png;base64,'+(await sharp(await readFile(new URL('woodgrain-v2.webp',dir))).png().toBuffer()).toString('base64');
const count=20,frames=42,cols=7,rows=6,w=180,h=284;
const p=(r,a,back=false)=>[605+.85*r*Math.cos(a)+(back?19:0),615+r*Math.sin(a)+(back?-5:0)];
const pairs=(...ps)=>ps.map(v=>v.map(n=>n.toFixed(3)).join(',')).join(' ');
const layers=[],geometry=[];
for(let frame=0;frame<frames;frame++){
 const phase=frame/frames*Math.PI*2/count,parts=[],sample=[];
 for(let i=0;i<count;i++){
  const a=phase+i*Math.PI*2/count,end=a+Math.PI*2/count,facing=Math.cos(a+Math.PI/count);
  if(facing<=-.18)continue;
  const fade=Math.min(1,(facing+.18)/.3),a0=p(146,a),a1=p(164,a);
  const base=[p(147,a+.025),p(147,end-.025),p(147,end-.025,true),p(147,a+.025,true)];
  sample.push(base);
  parts.push(`<g opacity="${fade}"><polygon points="${pairs(...base)}" fill="#62543b"/><g transform="matrix(${a1[0]-a0[0]} ${a1[1]-a0[1]} 19 -5 ${a0[0]} ${a0[1]})"><image href="${texture}" width="1" height="1" preserveAspectRatio="none"/><rect width="1" height="1" fill="#282e22" opacity="${.12+.19*Math.max(0,Math.sin(a))}"/><rect width="1" height="1" fill="none" stroke="#4d4938" stroke-width=".3" vector-effect="non-scaling-stroke"/></g>`);
  if(Math.sin(a)>.05&&Math.sin(a)<.9&&Math.cos(a)>.35){const tip=p(161,a,true),length=15+25*Math.sin(a);parts.push(`<path d="M${tip[0]} ${tip[1]}q-2 ${length*.4} -5 ${length}m7 ${-length*.35}l-1 4" fill="none" stroke="#d0d5c4" stroke-width=".65" stroke-linecap="round" opacity=".23"/>`);}
  parts.push('</g>');
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="565 440 225 355">${parts.join('')}</svg>`;
 layers.push({input:await sharp(Buffer.from(svg)).png().toBuffer(),left:(frame%cols)*w,top:Math.floor(frame/cols)*h});
 geometry.push({frame,phase_degrees:phase*180/Math.PI,bases:sample});
}
const output=new URL('buckets-v2.webp',dir);
await sharp({create:{width:w*cols,height:h*rows,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).webp({quality:86,alphaQuality:100}).toFile(fileURLToPath(output));
await writeFile(new URL('bucket-geometry.json',import.meta.url),JSON.stringify({frames,cols,rows,frame_width:w,frame_height:h,scene_crop:[565,440,225,355],period_ms:1400,geometry}));
console.log(fileURLToPath(output));
