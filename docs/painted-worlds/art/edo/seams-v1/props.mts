import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';
const prompt = [
  'Hand-painted Japanese emaki handscroll from about 1805: fine sumi ink outlines with delicate pale watercolour washes,',
  'warm wood browns, straw ochre, grey stone, as in a detailed Edo street scroll. A sheet of THREE separate roadside',
  'objects of an Edo town street, drawn side by side, evenly spaced, not touching, all at the same scale, seen from the',
  'same slightly elevated three-quarter view: (left) a two-wheeled wooden handcart parked with a few straw-wrapped',
  'bundles on it; (middle) a neat pile of split firewood bundles tied with rope beside a wooden tub; (right) a low stack',
  'of four straw rice bales. Each object isolated on a fully transparent background: no ground, no shadow, no paper',
  'texture, no border. No people, no animals, no text.',
].join(' ');
const png = await generateImage(configFromEnv(), { prompt, size: '1536x1024', quality: 'high', background: 'transparent' });
await writeFile(process.argv[2], png);
console.log('props', png.length);
