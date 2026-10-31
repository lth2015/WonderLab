// Erases one region of a section by inpainting it as empty street (TokenStars edits).
// usage: tsx erase.mts <in.png> <out.png> <x> <y> <w> <h>
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';

const require = createRequire('/home/user/wonderlab/package.json');
const sharp = require('sharp');
const [inp, out, ...r] = process.argv.slice(2);
const [x, y, w, h] = r.map(Number);
const cfg = configFromEnv();

const src = await readFile(inp);
const { width: W, height: H } = await sharp(src).metadata();
// the image itself, with the region cleared, and a mask transparent over the region
const hole = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const image = await sharp(src).ensureAlpha().composite([{ input: hole, left: x, top: y, blend: 'dest-out' }]).png().toBuffer();
const mask = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/></svg>`), blend: 'dest-out' }])
  .png()
  .toBuffer();

const form = new FormData();
form.append('model', cfg.imageModel);
form.append(
  'prompt',
  'Hand-painted Japanese emaki street scene, fine ink lines and pale watercolour wash on aged paper. Fill the cleared area with plain, empty earthen street matching the surrounding ground exactly: same colour, texture and small pebbles. No people, no animals, no objects, no text.',
);
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
const item = JSON.parse(text).data[0];
const png = item.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
// keep the original everywhere except the region (the edit may redraw elsewhere too)
const patch = await sharp(png).resize(W, H).extract({ left: x, top: y, width: w, height: h }).png().toBuffer();
await sharp(src).composite([{ input: patch, left: x, top: y }]).png().toFile(out);
console.log('patched', out);
