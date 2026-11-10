// 河岸の朝 (roadmap #158 item 4): the scroll goes on to the RIGHT of section 13 —
// the bridge reaches the far bank, then a morning riverside quay. TokenStars
// gpt-image-2 edits, outpainting rightwards from the right 512 px of street-13.
//
//   tsx kashi.mts <outdir> street [K1 K2 K3]   # three extensions, ~700 units each
//   tsx kashi.mts <outdir> people              # おまつ and 亀吉 sheets (transparent)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const require = createRequire('/home/user/wonderlab/package.json');
const sharp = require('sharp');
const W = 1536, H = 1024, KEEP = 512;
const cfg = configFromEnv();
const SRC = '/home/user/wonderlab/apps/qingming-edo/src/assets/art/street-13.webp';

const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey',
  'roof tiles, clear blue-grey river water) on warm pale paper. Clear readable detail in timber, stone and goods.',
  'Strictly no text of any kind: no writing on curtains, signboards, barrels or boats, no calligraphy, no seals.',
  'No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const CONT = [
  INK,
  'CONTINUE THE SAME PAINTING SEAMLESSLY TO THE RIGHT. The left part of the picture is already painted: match it',
  'exactly — the same scale, the same horizon and river level, the same oblique bird\'s-eye view, the same pale',
  'paper colour and light, the same stone-bank height. Nothing gets bigger or nearer towards the right.',
  'NO PEOPLE AND NO ANIMALS anywhere: an empty scene just before the morning crowd.',
].join(' ');

const STREET: Record<string, string> = {
  K1: `${CONT} The wooden arched bridge with its black-capped railing posts continues to the right across the river and comes down onto the far stone bank. On the far bank, at the bridge foot: a stone-paved landing with wide wooden steps down to the water, a willow, and the first low roofed sheds of a riverside quay.`,
  K2: `${CONT} Going right along the far bank: a busy morning riverside quay (kashi) — a long row of low open-fronted wooden sheds with tiled roofs; shallow wooden tubs and round bamboo baskets set out on the stone pavement; stacked wooden fish boxes and straw-wrapped bales; three or four small flat cargo boats moored at the stone bank with ropes and poles, baskets in them; wooden posts in the water.`,
  K3: `${CONT} Going right, the quay quietens: a few more moored boats and a pile of barrels and empty baskets beside a small wooden boat-hut; then the stone bank turns away and the river widens towards open water, with only reeds and a few posts, fading into plain pale paper at the right edge.`,
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
const PEOPLE: Record<string, string> = {
  omatsu: SHEET(
    'elderly Edo fishwife in her late sixties, small and a little bent, grey hair tied up simply, a plain indigo-and-grey striped kimono with sleeves tied back by a cord, a dark apron, straw sandals',
    '(1) standing and looking around anxiously, one hand shading her eyes; (2) smiling warmly with both hands together; (3) sitting on a low wooden stool beside an empty shallow fish tub, resting.',
  ),
  kamekichi: SHEET(
    'Edo boy about eight years old, round face, short hair with a small topknot, a short brown kimono tucked up at the knees, bare legs, straw sandals',
    '(1) crouching low and peeking out sideways, eager and curious, as if hiding to watch something; (2) standing up a little embarrassed, scratching his head; (3) standing and pointing excitedly to the left with a big smile.',
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

/** The previous picture's RIGHT strip on the LEFT of a new canvas; the rest is left to paint. */
async function canvasFrom(prev: Buffer): Promise<{ image: Buffer; mask: Buffer }> {
  const meta = await sharp(prev).metadata();
  const strip = await sharp(prev).extract({ left: meta.width! - KEEP, top: 0, width: KEEP, height: H }).png().toBuffer();
  const empty = { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const image = await sharp({ create: empty }).composite([{ input: strip, left: 0, top: 0 }]).png().toBuffer();
  const keep = await sharp({ create: { width: KEEP, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  const mask = await sharp({ create: empty }).composite([{ input: keep, left: 0, top: 0 }]).png().toBuffer();
  return { image, mask };
}

/** street-13 at the model's scale: 980 px high → 1024. */
async function start(): Promise<Buffer> {
  return sharp(SRC).resize({ height: H }).png().toBuffer();
}

const [out, what, ...only] = process.argv.slice(2);
if (what === 'street') {
  const order = ['K1', 'K2', 'K3'];
  const run = only.length ? only : order;
  const first = order.indexOf(run[0]);
  let prev: Buffer = first > 0 ? await readFile(`${out}/kashi-${order[first - 1]}.png`) : await start();
  for (const s of run) {
    const t0 = Date.now();
    const { image, mask } = await canvasFrom(prev);
    const png = await edit(image, mask, STREET[s]);
    await writeFile(`${out}/kashi-${s}.png`, png);
    console.log(s, png.length, 'bytes', Math.round((Date.now() - t0) / 1000), 's');
    prev = png;
  }
} else if (what === 'people') {
  await Promise.all(
    Object.entries(PEOPLE).map(async ([name, prompt]) => {
      const t0 = Date.now();
      const png = await generateImage(cfg, { prompt, size: `${W}x${H}`, quality: 'high', background: 'transparent' });
      await writeFile(`${out}/sheet-${name}.png`, png);
      console.log(name, png.length, 'bytes', Math.round((Date.now() - t0) / 1000), 's');
    }),
  );
} else throw new Error('usage: <outdir> street [K1 K2 K3] | people');
