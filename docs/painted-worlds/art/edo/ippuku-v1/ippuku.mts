// 一服の画 (event picture): the view from 喜助's tea-house bench while resting (ui/Shop.tsx).
// Portrait, for phones; the street shows through behind a tray of tea and dango.
// TokenStars gpt-image-2, same INK wording as ../kashi-v1/kashi.mts.
//   tsx ippuku.mts <outdir> [n]
import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey)',
  'on warm pale paper. Clear readable detail. Strictly no text of any kind: no writing on curtains, signboards or lanterns.',
  'No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');
const prompt = [
  INK,
  'A quiet moment seen from a seat at an Edo tea house: in the near foreground, the edge of a low wooden bench covered with a red felt cloth,',
  'on it a small round lacquered tray with a plain earthenware teacup of green tea with a thin wisp of steam, and a small plate with one skewer of three dango.',
  'Beyond, slightly below eye level, the spring street of Nihonbashi: a row of wooden shops with tiled roofs and plain dyed noren curtains,',
  'a willow, a few small unhurried passers-by far away (a peddler with a shoulder pole, a woman with a parasol, a child), soft morning light.',
  'Calm, intimate, unhurried. Vertical composition, the tray in the lower third, the street in the middle, sky and roofs at the top.',
].join(' ');

const cfg = configFromEnv();
const [out, n = '2'] = process.argv.slice(2);
if (!out) throw new Error('usage: tsx ippuku.mts <outdir> [n]');
await Promise.all(
  Array.from({ length: +n }, async (_, i) => {
    try {
      await writeFile(`${out}/ippuku-${i}.png`, await generateImage(cfg, { prompt, size: '1024x1536', quality: 'high' }));
      console.log('ok', i);
    } catch (e) {
      console.log('FAIL', i, (e as Error).message);
    }
  }),
);
