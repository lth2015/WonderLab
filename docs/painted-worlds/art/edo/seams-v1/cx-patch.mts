// Repaints the lower part of one join in the joined Edo roll (TokenStars edits).
// The window around the join is sent whole; only a band over the join, from y0
// down, is open to the model. cx-build.cjs pastes the band back, feathered.
// usage: tsx cx-patch.mts <scratchpad> <pair> <what to join>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';

const require = createRequire('/home/user/wonderlab/package.json');
const sharp = require('sharp');
const [S, pair, what] = process.argv.slice(2);
const seams = JSON.parse(await readFile(`${S}/cx/seams.json`, 'utf8')) as { pair: string; centerPx: number }[];
const seam = seams.find((s) => s.pair === pair);
if (!seam) throw new Error(`no seam ${pair}`);
const W = 1024, H = 980, SIDE = 1024;
const BAND = 200, FEATHER = 40, Y0 = 430;
const x0 = seam.centerPx - W / 2;

const win = await sharp(`${S}/cx/runtime-full.png`).extract({ left: x0, top: 0, width: W, height: H }).png().toBuffer();
// square canvas: the window, its last row stretched down to fill
const image = await sharp(win).extend({ bottom: SIDE - H, extendWith: 'copy' }).png().toBuffer();
const band = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIDE}" height="${SIDE}"><rect x="${W / 2 - BAND / 2 - FEATHER}" y="${Y0 - FEATHER}" width="${BAND + 2 * FEATHER}" height="${SIDE}" fill="black"/></svg>`;
const mask = await sharp({ create: { width: SIDE, height: SIDE, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: Buffer.from(band), blend: 'dest-out' }])
  .png()
  .toBuffer();

const prompt = [
  'Hand-painted Japanese emaki handscroll street of Edo about 1805, fine sumi ink lines and pale watercolour on warm paper,',
  'exactly matching the surrounding painting. Repaint only the cleared vertical strip so that the left and right halves',
  `join seamlessly: ${what}. Keep the same perspective, scale, colours, stone sizes and line weight as on both sides.`,
  'No people, no animals, no text.',
].join(' ');

const cfg = configFromEnv();
const form = new FormData();
form.append('model', cfg.imageModel);
form.append('prompt', prompt);
form.append('size', `${SIDE}x${SIDE}`);
form.append('quality', 'high');
form.append('n', '1');
form.append('image', new Blob([image], { type: 'image/png' }), 'image.png');
form.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
const t0 = Date.now();
const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), {
  method: 'POST',
  headers: { authorization: `Bearer ${cfg.apiKey}` },
  body: form,
  signal: AbortSignal.timeout(300000),
});
const text = await res.text();
if (!res.ok) throw new Error(`edit failed: HTTP ${res.status} ${text.slice(0, 300)}`);
const item = JSON.parse(text).data[0];
const png = item.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
await mkdir(`${S}/cx/patches`, { recursive: true });
const name = pair.replace('|', '-');
await writeFile(`${S}/cx/patches/${name}.png`, png);
await writeFile(`${S}/cx/patches/${name}.json`, JSON.stringify({ pair, image: `${name}.png`, x0, w: W, hFull: SIDE, band: BAND, feather: FEATHER, y0: Y0, prompt }, null, 1));
await writeFile(`${S}/cx/patches/${name}-before.png`, win);
console.log(pair, 'patched in', Math.round((Date.now() - t0) / 1000), 's');
