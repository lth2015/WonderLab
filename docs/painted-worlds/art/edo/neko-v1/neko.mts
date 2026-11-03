// 茶店の猫 (ninth story): the tea house cat, three poses on one transparent sheet.
// TokenStars gpt-image-2, same INK wording as ../kashi-v1/kashi.mts.
//
//   tsx neko.mts <outdir>     # writes sheet-neko.png; then python3 cut.py in <outdir>
import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey',
  'roof tiles, clear blue-grey river water) on warm pale paper. Clear readable detail in timber, stone and goods.',
  'Strictly no text of any kind: no writing on curtains, signboards, barrels or boats, no calligraphy, no seals.',
  'No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const prompt = [
  INK,
  'A character sheet of ONE small Japanese bobtail cat, white with amber-orange and black patches (a calico, mikeneko),',
  'a short bobbed tail, amber eyes. Drawn three times side by side, the identical cat with the identical patches each time,',
  'same size, seen from the same slightly elevated three-quarter side view, evenly spaced and not overlapping:',
  '(1) sitting upright, calm, looking to the left; (2) running and leaping to the left, body stretched, legs extended;',
  '(3) lying curled up like a loaf, eyes half closed, content.',
  'Full figures, nothing cut off. Each figure isolated on a fully transparent background: no ground, no shadow,',
  'no paper texture behind it, no border.',
].join(' ');

const out = process.argv[2] ?? '.';
const t0 = Date.now();
const png = await generateImage(configFromEnv(), { prompt, size: '1536x1024', quality: 'high', background: 'transparent' });
await writeFile(`${out}/sheet-neko.png`, png);
console.log('neko', png.length, 'bytes', Math.round((Date.now() - t0) / 1000), 's');
