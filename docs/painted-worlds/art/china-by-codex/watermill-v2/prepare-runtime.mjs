import sharp from 'sharp';
import {resolve,join} from 'node:path';
import {mkdir} from 'node:fs/promises';
if(!process.argv[2])throw new Error('Usage: node prepare-runtime.mjs <output-directory>');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const face=new URL('rotor-face-source.png',import.meta.url),water=new URL('falling-water-source.png',import.meta.url);
await sharp(face).trim().extend({top:8,bottom:8,left:8,right:8,background:{r:0,g:0,b:0,alpha:0}}).resize(272,320,{fit:'fill'}).modulate({brightness:.74,saturation:.6}).webp({quality:90,alphaQuality:100}).toFile(join(out,'face-v2.webp'));
await sharp(face).extract({left:560,top:55,width:128,height:48}).resize(32,12).modulate({brightness:.74,saturation:.6}).webp({quality:90}).toFile(join(out,'woodgrain-v2.webp'));
await sharp(water).extract({left:320,top:0,width:420,height:1536}).resize(56,192).modulate({saturation:.6,brightness:.9}).webp({quality:90,alphaQuality:100}).toFile(join(out,'fall-texture-v2.webp'));
