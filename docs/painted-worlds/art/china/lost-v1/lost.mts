// 汴河拾遗 (C5 寻物): five small lost things on one transparent sheet, in the style of the
// long scroll (../long-v1/cn-long.mts STYLE). TokenStars gpt-image-2.
//   tsx lost.mts <outdir>     # writes sheet-lost.png; then python3 cut.py <outdir>
import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const STYLE = [
  'In the manner of the meticulous fine ink linework and pale mineral washes of a Northern Song handscroll',
  "(Zhang Zeduan's Along the River During the Qingming Festival; an original drawing, not a copy).",
  'Fine warm charcoal and tea-brown ink outlines, translucent watercolour and mineral pigment.',
  'Palette: warm gray ink, weathered bamboo and timber browns, restrained ochre, a tiny muted cinnabar accent.',
  'No lettering, no calligraphy, no characters, no seals with visible carving, no watermark.',
  'NOT cartoon, NOT 3D, NOT photo, NOT Japanese.',
].join(' ');

const prompt = [
  STYLE,
  'A sheet of FIVE small separate everyday objects of a Northern Song town, side by side in one row, evenly spaced, not overlapping, each about the same size on the sheet,',
  'seen from a slightly elevated three-quarter view:',
  '(1) a slender bamboo writing brush with a dark tip; (2) a small cord of faded red silk tied in a simple round knot with a short tassel;',
  '(3) a short bamboo whistle with two finger holes on a thin cord; (4) a curved wooden hair comb, plain, worn smooth;',
  '(5) a small square stone seal with a little carved animal on top, lying so that its carved face is hidden (no characters visible).',
  'Each object isolated on a fully transparent background: no ground, no shadow, no paper texture behind it, no border.',
].join(' ');

const out = process.argv[2] ?? '.';
const png = await generateImage(configFromEnv(), { prompt, size: '1536x1024', quality: 'high', background: 'transparent' });
await writeFile(`${out}/sheet-lost.png`, png);
console.log('lost', png.length, 'bytes');
