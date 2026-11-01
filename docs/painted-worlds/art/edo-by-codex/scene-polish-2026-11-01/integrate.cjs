const repo = process.argv[2] || process.cwd();
const sharp = require(require.resolve('sharp', { paths: [repo] }));
const fs = require('node:fs');
const root = process.argv[3] || '/workspace/.cloud-setup/edo-polish';
const generatedPath = process.argv[4] || '/workspace/generated_images/exec-08ed6730-6fcc-4d22-80a2-6b5295fda21b.png';
function cut(a,b,w,h,start,end) {
 const width=end-start, acc=new Float64Array(width*h), from=new Int32Array(width*h);
 for(let y=0;y<h;y++) for(let u=0;u<width;u++){
  const i=(y*w+start+u)*3;let d=0;
  for(let c=0;c<3;c++)d+=(a[i+c]-b[i+c])**2;
  const cost=Math.sqrt(d)+(Math.min(u,width-1-u)<8?100:0);
  let best=0,bx=u;
  if(y){best=Infinity;for(let dx=-1;dx<=1;dx++){let p=u+dx;if(p>=0&&p<width&&acc[(y-1)*width+p]<best){best=acc[(y-1)*width+p];bx=p;}}}
  acc[y*width+u]=best+cost;from[y*width+u]=bx;
 }
 let u=0;for(let x=1;x<width;x++)if(acc[(h-1)*width+x]<acc[(h-1)*width+u])u=x;
 const path=new Int32Array(h);for(let y=h-1;y>=0;y--){path[y]=start+u;u=from[y*width+u];}
 return path;
}
(async()=>{
 const w=1120,h=980;
 const before=await sharp(root+'/canal-before.png').removeAlpha().raw().toBuffer();
 const generated=await sharp(generatedPath).resize(w,h,{fit:'fill'}).removeAlpha().raw().toBuffer();
 const left=cut(before,generated,w,h,240,430),right=cut(before,generated,w,h,800,1020);
 const out=Buffer.from(before);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=Math.min(1,Math.max(0,(x-left[y]+2)/4),Math.max(0,(right[y]-x+2)/4));
  if(t===0)continue;const i=(y*w+x)*3;for(let c=0;c<3;c++)out[i+c]=Math.round(before[i+c]*(1-t)+generated[i+c]*t);
 }
 await sharp(out,{raw:{width:w,height:h,channels:3}}).png().toFile(root+'/canal-after.png');
 const patch=sharp(out,{raw:{width:w,height:h,channels:3}});
 const a=await patch.clone().extract({left:0,top:0,width:560,height:h}).png().toBuffer();
 const b=await patch.clone().extract({left:560,top:0,width:560,height:h}).png().toBuffer();
 const dest=repo+'/apps/qingming-edo/src/assets/art';
 await sharp(root+'/street-0-before.webp').composite([{input:a,left:840,top:0}]).webp({quality:94}).toFile(dest+'/street-0.webp');
 await sharp(root+'/street-1-before.webp').composite([{input:b,left:0,top:0}]).webp({quality:94}).toFile(dest+'/street-1.webp');
 fs.writeFileSync(root+'/patch-cuts.json',JSON.stringify({crop:{x:840,y:0,width:w,height:h},world:{x:600,y:0,width:800,height:700},left:[...left],right:[...right],feather_px:4}));
 console.log('patched street-0/1 at fixed world x600-1400; outer margins retained');
})();

