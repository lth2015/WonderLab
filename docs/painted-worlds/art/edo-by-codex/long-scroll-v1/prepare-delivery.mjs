import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.PAINTED_SHARP_PATH || 'sharp');
const [inputFile] = process.argv.slice(2);
if (!inputFile) throw new Error('Pass the generation input JSON path.');
const input = JSON.parse(await fs.readFile(inputFile, 'utf8'));
const dir = path.dirname(new URL(import.meta.url).pathname);
const manifestFile = path.join(dir, 'manifest-v1.json');
let manifest;
try { manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8')); }
catch (error) { if(error.code !== 'ENOENT') throw error; manifest = {tool:'built-in image_gen',world:{width:14000,height:700,sections:14},master:{file:'../edo-nihonbashi-key-v1.png',worldX:0,drawWidth:2100,drawHeight:700,visibleEnd:2000,sections:[1,2]},assets:[]}; }
for (const item of input) {
  const name = `edo-segment-${String(item.section).padStart(2,'0')}-v1`;
  const nativeFile = path.join(dir, name+'.png');
  await fs.copyFile(item.path, nativeFile);
  await fs.writeFile(path.join(dir,name+'.prompt.txt'), item.prompt+'\n');
  const m = await sharp(nativeFile).metadata();
  const webp = await sharp(nativeFile).webp({quality:94,effort:6}).toFile(path.join(dir,name+'.webp'));
  const buffer = await fs.readFile(nativeFile);
  // Center crop window preserves physical proportions if native aspect differs.
  const ratio = 1128/700;
  const cropWidth = Math.min(m.width, m.height*ratio);
  const cropHeight = cropWidth/ratio;
  const record = {section:item.section,title:item.title,status:'original delivered; seam and runtime anchoring require integration',native:{file:name+'.png',width:m.width,height:m.height,bytes:buffer.length,alpha:m.hasAlpha,sha256:crypto.createHash('sha256').update(buffer).digest('hex')},webp:{file:name+'.webp',quality:94,bytes:webp.size},world:{x:(item.section-1)*1000-64,width:1128,height:700,visibleX:(item.section-1)*1000,visibleWidth:1000},sourceWindow:{x:(m.width-cropWidth)/2,y:(m.height-cropHeight)/2,width:cropWidth,height:cropHeight},reference:item.reference,prompt:name+'.prompt.txt',review:item.review};
  manifest.assets = manifest.assets.filter(a=>a.section!==item.section).concat(record).sort((a,b)=>a.section-b.section);
  console.log(JSON.stringify({section:item.section,title:item.title,width:m.width,height:m.height,webpBytes:webp.size}));
}
await fs.writeFile(manifestFile, JSON.stringify(manifest,null,2)+'\n');
