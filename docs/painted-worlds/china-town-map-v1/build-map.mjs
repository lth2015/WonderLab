/** Deterministic thumbnail of the existing Chinese roll; no generated lettering or new art. */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=new URL('../../../',import.meta.url);
const source=new URL('apps/qingming-china/public/art/china/scroll/',root);
const dest=new URL('apps/qingming-china/public/art/china/map/china-map.webp',root);
const size=160, tileGroups=[[15,16,17,18,19],[10,11,12,13,14],[5,6,7,8,9],[0,1,2,3,4]];
const layers=[];
for(const [row,tiles] of tileGroups.entries())for(const [col,tile] of tiles.entries()){
 const input=await sharp(fileURLToPath(new URL(`scroll-${String(tile).padStart(2,'0')}.webp`,source))).resize(size,size,{fit:'fill'}).toBuffer();
 layers.push({input,left:col*size,top:row*size});
}
await mkdir(fileURLToPath(new URL('.',dest)),{recursive:true});
await sharp({create:{width:800,height:640,channels:3,background:'#ede5d0'}}).composite(layers).webp({quality:84}).toFile(fileURLToPath(dest));
console.log('Built China map: 800 × 640, four rows, original tile order preserved within each row.');
