// The long street for 清明上河図：江戸編 via TokenStars (owner-approved, 2026-10-31).
// Section A (right end, the bridge) is generated; B and C extend it to the left
// by outpainting, each keeping the left third of the previous section in view
// so roofs, shop fronts and the road carry on across the joins.
//
// usage: tsx edo-street.mts <outdir> [A|B|C ...]   (default: A B C)
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { configFromEnv, generateImage } from '/home/user/wonderlab/server/src/tokenstars.ts';

const require = createRequire('/home/user/wonderlab/package.json');
const sharp = require('sharp');

const W = 1536;
const H = 1024;
const KEEP = 512; // px of the previous section kept as the reference on the right

const STYLE = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey',
  'roof tiles) on warm aged paper. Clear readable detail in clothing folds, tools and timber joinery.',
  'Seen from slightly above at an oblique angle, as in an Edo street handscroll: the row of two-storey wooden',
  'townhouses runs perfectly horizontally across the whole picture, parallel to the bottom edge; tiled roofs and',
  'latticed upper floors in the upper part, open shop fronts with raised wooden floors in the middle, the earthen',
  'street as a level horizontal band along the bottom third. The same scale everywhere, no perspective',
  'convergence. Only a few thin, faint wisps of gold mist along the very top edge.',
  'Strictly no text of any kind: no writing on curtains or signboards, no calligraphy, no seals, no signature.',
  'No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const PROMPTS: Record<string, string> = {
  A: [
    STYLE,
    'This is the right-hand end of the street. On the far right, the north end of an old wooden arched bridge',
    'rising off the right edge over a river, wooden railings with bronze onion-shaped post caps, the stone',
    'embankment, a willow tree and a cargo boat with straw bales on the water. Then, going left: a paper shop',
    'with plain persimmon-coloured split noren curtains and neat stacks of washi paper on its shop floor; then a',
    'tools and utensils shop with plain indigo noren and lacquer boxes and bowls on display. The row of houses',
    'continues past the left edge. Leave the paper shop floor, the tools shop floor and the bridge foot EMPTY',
    'of people. Two or three small passers-by on the street at the lower left only. Sparrows on a roof.',
  ].join(' '),
  B: [
    STYLE,
    'Continue the same street seamlessly to the left: the right part of the picture is already painted; extend',
    'it with the same roof line, the same eave height, the same street band and the same light. Going left: a',
    'tea house with a wide open front, reed blinds, a low bench covered with a red cloth, a kettle on a small',
    'hearth with a little white steam, tea cups on a tray; then a narrow alley between houses with a well and a',
    'rain barrel; a dog lying in the street. Leave the tea house front and the space in front of it EMPTY of',
    'people. Two or three small passers-by on the street only. The row of houses continues past the left edge.',
  ].join(' '),
  C: [
    STYLE,
    'Continue the same street seamlessly to the left: the right part of the picture is already painted; extend',
    'it with the same roof line, the same eave height, the same street band and the same light. Going left: a',
    'rice shop with plain green noren and straw rice bales stacked at the front; then a cotton cloth shop with',
    'plain persimmon noren and folded bolts of cloth on its shop floor; a fire-watch ladder against a roof. A',
    'wide empty stretch of street in the middle of the picture. Three or four small passers-by: a porter with a',
    'bundle, two townswomen, a monk with a straw hat. The row of houses ends at the left edge with a gap.',
  ].join(' '),
};

async function edit(cfg: ReturnType<typeof configFromEnv>, image: Buffer, mask: Buffer, prompt: string): Promise<Buffer> {
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

/** The previous section's left KEEP px placed at the right of an empty canvas, and the matching mask. */
async function canvasFrom(prev: Buffer): Promise<{ image: Buffer; mask: Buffer }> {
  const strip = await sharp(prev).extract({ left: 0, top: 0, width: KEEP, height: H }).png().toBuffer();
  const empty = { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const image = await sharp({ create: empty }).composite([{ input: strip, left: W - KEEP, top: 0 }]).png().toBuffer();
  // transparent where the model paints, opaque where it keeps
  const keep = await sharp({ create: { width: KEEP, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  const mask = await sharp({ create: empty }).composite([{ input: keep, left: W - KEEP, top: 0 }]).png().toBuffer();
  return { image, mask };
}

const out = process.argv[2];
const which = process.argv.slice(3).length ? process.argv.slice(3) : ['A', 'B', 'C'];
const cfg = configFromEnv();
for (const s of which) {
  const t0 = Date.now();
  let png: Buffer;
  if (s === 'A') {
    png = await generateImage(cfg, { prompt: PROMPTS.A, size: `${W}x${H}`, quality: 'high' });
  } else {
    const prevName = `${out}/street-${s === 'B' ? 'A' : 'B'}.png`;
    if (!existsSync(prevName)) throw new Error(`needs ${prevName}`);
    const { image, mask } = await canvasFrom(await readFile(prevName));
    png = await edit(cfg, image, mask, PROMPTS[s]);
  }
  await writeFile(`${out}/street-${s}.png`, png);
  console.log(s, png.length, 'bytes in', Math.round((Date.now() - t0) / 1000), 's');
}
