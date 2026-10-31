// Style samples for 清明上河図：江戸編 via TokenStars (owner-approved, 2026-10-31).
// usage: tsx edo-gen.mts <bg|seita> <out.png>
import { writeFile } from 'node:fs/promises';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const STYLE = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey',
  'roof tiles) on warm aged paper. Clear readable detail in clothing folds, tools and timber joinery.',
  'Strictly no text of any kind: no writing on curtains or signboards, no calligraphy, no seals, no signature.',
  'No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const BG = [
  STYLE,
  'Elevated three-quarter bird\'s-eye view looking down on the street, oblique parallel projection like a',
  'traditional scroll, no vanishing point. Only a few thin, faint wisps of gold mist along the very top edge;',
  'most of the picture is clear.',
  'Scene, right to left: on the far right the north end of an old wooden arched bridge over a river, wooden',
  'railings with bronze onion-shaped post caps, a cargo boat with straw bales on the water, a willow tree on the',
  'stone embankment. Then a row of two-storey wooden merchant townhouses with deep tiled eaves, latticed upper',
  'windows and open shop fronts with raised wooden floors. The first, nearest the bridge, is a paper shop with',
  'plain persimmon-coloured split noren curtains and neat stacks of washi paper on the shop floor; the front',
  'edge of its shop floor and the open ground in front of it and at the bridge foot are EMPTY, with nobody',
  'standing or kneeling there. Next a tools and utensils shop with plain indigo noren, lacquer boxes and bowls',
  'on display. Sparrows on a roof.',
  'A few small passers-by only in the lower left part of the street: a porter with baskets on a shoulder pole,',
  'two women in kimono talking, a man bowing to a customer. Leave the paper shop front and the bridge foot',
  'clear of people.',
].join(' ');

const SEITA = [
  STYLE,
  'A character sheet of ONE young Edo shop clerk (tedai) of a paper shop, about twenty years old, shaven pate',
  'with a neat topknot, pale indigo striped cotton kimono with a dark obi, bare feet, gentle face. Drawn three',
  'times side by side, the same man with the identical face, hairstyle and kimono pattern each time, same size,',
  'seen from the same elevated three-quarter view, evenly spaced and not overlapping:',
  '(left) kneeling and leaning forward, both hands pressing loose sheets of paper flat, one hand holding a dark',
  'rectangular paperweight, a worried face;',
  '(middle) kneeling upright and bowing deeply in thanks, hands on his knees, relieved smile;',
  '(right) standing at ease, hands folded in his sleeves, smiling.',
  'Full figures, nothing cut off. Each figure isolated on a fully transparent background: no ground, no',
  'shadow, no paper texture behind them, no border.',
].join(' ');

const which = process.argv[2];
const out = process.argv[3];
const cfg = configFromEnv();
const t0 = Date.now();
const png =
  which === 'bg'
    ? await generateImage(cfg, { prompt: BG, size: '1536x1024', quality: 'high' })
    : await generateImage(cfg, { prompt: SEITA, size: '1536x1024', quality: 'high', background: 'transparent' });
await writeFile(out, png);
console.log(which, 'wrote', out, png.length, 'bytes in', Math.round((Date.now() - t0) / 1000), 's');
