// Round 2 of 清明上河図：江戸編 art at the agreed scale (style decision v1 #4: main
// people 90 of 700 units). TokenStars gpt-image-2 (owner-approved, 2026-10-31).
//
//   tsx edo90.mts <outdir> mid      # street A (right end) → B → C, outpainting leftwards
//   tsx edo90.mts <outdir> far      # far layer A → B → C
//   tsx edo90.mts <outdir> chars    # 喜助, お春, 金次 sheets (in parallel)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const require = createRequire('/home/user/wonderlab/package.json');
const sharp = require('sharp');
const W = 1536, H = 1024, KEEP = 512;
const cfg = configFromEnv();

const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey',
  'roof tiles) on warm pale paper. Clear readable detail in timber joinery, tiles and goods.',
  'Strictly no text of any kind: no writing on curtains or signboards, no calligraphy, no seals, no signature.',
  'No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const MID = [
  INK,
  'Seen from slightly above at an oblique angle, as in an Edo street handscroll, from FURTHER AWAY than usual:',
  'the row of two-storey wooden townhouses runs horizontally across the whole picture; from the street to the',
  'roof ridge each house is only about one third of the picture height. The roof ridges lie about one third down',
  'from the top. ABOVE THE ROOFS THE SKY IS PLAIN, EMPTY, UNTOUCHED PALE PAPER with nothing drawn in it: no',
  'clouds, no mist, no birds, no distant buildings, no trees behind the roofs. Open shop fronts with raised wooden',
  'floors; the earthen street is a wide level band along the bottom third. NO PEOPLE AND NO ANIMALS anywhere: an',
  'empty street just before the morning crowd.',
].join(' ');

// For the extensions: no size wording (it made each section smaller than the
// last); the painted part on the right sets the scale.
const CONT = [
  INK,
  'CONTINUE THE SAME STREET SEAMLESSLY TO THE LEFT. The right part of the picture is already painted: match it',
  'exactly — the same size of buildings, the same roof-ridge height, the same eave line, the same street edge and',
  'street band, the same oblique view, the same pale paper colour and light. The sky above the roofs stays plain,',
  'empty, untouched pale paper with nothing drawn in it. NO PEOPLE AND NO ANIMALS anywhere.',
].join(' ');

const MID_SECTIONS: Record<string, string> = {
  A: [
    MID,
    'This is the right-hand end of the street. On the far right, the north end of an old wooden arched bridge rising',
    'off the right edge over a river, wooden railings with bronze onion-shaped post caps, a stone embankment, a willow',
    'on the bank and an empty cargo boat with straw bales moored below. Going left: a paper shop with plain',
    'persimmon-coloured split noren and neat stacks of washi paper on its floor; then a tools and utensils shop with',
    'plain indigo noren, lacquer boxes and bowls on shelves. The row continues past the left edge.',
  ].join(' '),
  B: [
    CONT,
    'Going left: a tea house with a wide open front, reed blinds, a low bench with a red cloth, a kettle on a small',
    'hearth, tea cups on a tray; then a narrow alley with a well and a rain barrel.',
  ].join(' '),
  C: [
    CONT,
    'Going left: a sundries shop with pale blue noren and baskets and brooms; then a rice shop with plain green',
    'noren and straw rice bales stacked at the front.',
  ].join(' '),
  D: [
    CONT,
    'Going left: a cotton cloth shop with plain persimmon noren and folded bolts of cloth; a fire-watch ladder',
    'leaning on its roof; a wide stretch of empty street; the row of houses ends near the left edge with a gap.',
  ].join(' '),
};

const FAR = [
  INK,
  'A distant view only, very pale and faint, in light grey-blue distant ink (#96917d) with almost no colour: low',
  'rows of distant tiled roofs of a city seen far away, a few clumps of distant trees, one wooden fire-watch tower,',
  'the faint line of a far storehouse wall. Everything sits in the lower middle of the picture as a thin band; the',
  'upper half is plain pale paper with two or three very thin wisps of pale gold mist. No people, no animals, no',
  'river in the foreground, nothing near the viewer. Horizontal, continuous, like the background of a handscroll.',
].join(' ');
const FAR_SECTIONS: Record<string, string> = {
  A: FAR,
  B: `${FAR} Continue the same distant view seamlessly to the left, same height and paleness.`,
  C: `${FAR} Continue the same distant view seamlessly to the left, same height and paleness.`,
};

const SHEET = (who: string, poses: string) =>
  [
    INK,
    `A character sheet of ONE ${who}. Drawn three times side by side, the same person with the identical face,`,
    'hairstyle and clothing pattern each time, same size, seen from the same slightly elevated three-quarter view,',
    'evenly spaced and not overlapping:',
    poses,
    'Full figures, nothing cut off. Each figure isolated on a fully transparent background: no ground, no shadow,',
    'no paper texture behind them, no border.',
  ].join(' ');

const CHARS: Record<string, string> = {
  kisuke: SHEET(
    'Edo-period tea house master, about fifty, round kindly face, receding hair in a small topknot, plain ochre-brown cotton kimono with sleeves tied back by a cord, a dark apron, wooden geta',
    '(left) standing holding a small iron teapot, looking out at the street; (middle) leaning forward pouring tea into a cup on a small tray; (right) bowing slightly with a warm smile, hands on his apron.',
  ),
  oharu: SHEET(
    'young Edo-period townswoman working as an errand runner, about eighteen, hair in a simple shimada bun, plain rose-brown cotton kimono with a narrow indigo obi, a small cloth bundle, straw sandals, an earnest face',
    '(left) standing and looking around anxiously, a hand at her collar, as if searching for something; (middle) asking politely with her hands together, slightly bowed; (right) holding up a folded indigo-dyed tenugui cloth with both hands, relieved and happy.',
  ),
  kinji: SHEET(
    'Edo-period street peddler (furiuri), about thirty, wiry, a twisted headband, short ochre work kimono tucked up, dark leggings, straw sandals, a long wooden shoulder pole with a shallow basket hanging from each end',
    '(left) walking with the pole and both baskets balanced on his shoulder; (middle) standing with the baskets set down beside him, wiping his brow with a cloth; (right) holding the pole upright beside him, nodding with a grin.',
  ),
};

async function edit(image: Buffer, mask: Buffer, prompt: string): Promise<Buffer> {
  const form = new FormData();
  form.append('model', cfg.imageModel);
  form.append('prompt', prompt);
  form.append('size', `${W}x${H}`);
  form.append('quality', 'high');
  form.append('n', '1');
  form.append('image', new Blob([image], { type: 'image/png' }), 'image.png');
  form.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
  const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(300000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`edit failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  const item = JSON.parse(text)?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error('edit response had neither b64_json nor url');
}

async function canvasFrom(prev: Buffer): Promise<{ image: Buffer; mask: Buffer }> {
  const strip = await sharp(prev).extract({ left: 0, top: 0, width: KEEP, height: H }).png().toBuffer();
  const empty = { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const image = await sharp({ create: empty }).composite([{ input: strip, left: W - KEEP, top: 0 }]).png().toBuffer();
  const keep = await sharp({ create: { width: KEEP, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  const mask = await sharp({ create: empty }).composite([{ input: keep, left: W - KEEP, top: 0 }]).png().toBuffer();
  return { image, mask };
}

async function chain(out: string, prefix: string, prompts: Record<string, string>, only?: string[]) {
  let prev: Buffer | null = null;
  const all = prefix === 'mid' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C'];
  const run = only ?? all;
  // resuming at B or C starts from the section already on disk
  const first = all.indexOf(run[0]);
  if (first > 0) prev = await readFile(`${out}/${prefix}-${all[first - 1]}.png`);
  for (const s of run) {
    const t0 = Date.now();
    const png: Buffer = prev
      ? await (async () => {
          const { image, mask } = await canvasFrom(prev!);
          return edit(image, mask, prompts[s]);
        })()
      : await generateImage(cfg, { prompt: prompts[s], size: `${W}x${H}`, quality: 'high' });
    await writeFile(`${out}/${prefix}-${s}.png`, png);
    console.log(prefix, s, png.length, 'bytes', Math.round((Date.now() - t0) / 1000), 's');
    prev = png;
  }
}

const [out, what, ...only] = process.argv.slice(2);
if (what === 'mid') await chain(out, 'mid', MID_SECTIONS, only.length ? only : undefined);
else if (what === 'far') await chain(out, 'far', FAR_SECTIONS, only.length ? only : undefined);
else if (what === 'chars')
  await Promise.all(
    Object.entries(CHARS).map(async ([name, prompt]) => {
      const t0 = Date.now();
      const png = await generateImage(cfg, { prompt, size: `${W}x${H}`, quality: 'high', background: 'transparent' });
      await writeFile(`${out}/edo-${name}-01.png`, png);
      console.log(name, png.length, 'bytes', Math.round((Date.now() - t0) / 1000), 's');
    }),
  );
else throw new Error('usage: <outdir> mid|far|chars');
