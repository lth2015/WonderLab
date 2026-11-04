// 探し物 (treasure hunt): six small lost things on one transparent sheet.
// TokenStars gpt-image-2, same INK wording as ../kashi-v1/kashi.mts.
//   tsx lost.mts <outdir>     # writes sheet-lost.png; then python3 cut.py in <outdir>
import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey)',
  'on warm pale paper. Clear readable detail. Strictly no text of any kind. No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const prompt = [
  INK,
  'A sheet of SIX small separate Edo-period everyday objects, drawn side by side in one row, evenly spaced and not overlapping,',
  'each seen from a slightly elevated three-quarter view, each about the same size on the sheet:',
  '(1) a small carved wooden netsuke in the shape of a turtle, with a short cord; (2) a long thin kiseru tobacco pipe with brass ends;',
  '(3) a lacquered hair ornament kanzashi with a small red flower; (4) a folded paper fan with a plain pale pattern;',
  '(5) a small wooden spinning top koma, painted with red and indigo rings; (6) a tiny brass bell on a short red cord.',
  'Each object isolated on a fully transparent background: no ground, no shadow, no paper texture behind it, no border.',
].join(' ');

const out = process.argv[2] ?? '.';
const t0 = Date.now();
const png = await generateImage(configFromEnv(), { prompt, size: '1536x1024', quality: 'high', background: 'transparent' });
await writeFile(`${out}/sheet-lost.png`, png);
console.log('lost', png.length, 'bytes', Math.round((Date.now() - t0) / 1000), 's');
