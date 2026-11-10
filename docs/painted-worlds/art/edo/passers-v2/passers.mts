// Three more passers-by (owner 2026-11-10: people who stop and talk about their trade):
// a 飛脚 courier, a 大工 carpenter and a 飴売り candy seller, in the style and scale of the
// street's own passers-by (three of them are passed as the reference). gpt-image-2 edits.
//   tsx passers.mts <outdir> [n]      # writes sheet-<i>.png; then python3 cut.py <sheet> <outdir>
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';

const cfg = configFromEnv();
const ART = '/home/user/wonderlab/apps/qingming-edo/src/assets/art';
async function ref(): Promise<Buffer> {
  const ids = ['crowd2-samurai', 'crowd1-porter', 'crowd2-fishmonger'];
  const imgs = await Promise.all(ids.map(async (id) => sharp(await readFile(`${ART}/${id}.webp`)).resize({ height: 700 }).png().toBuffer()));
  const ws = await Promise.all(imgs.map(async (b) => (await sharp(b).metadata()).width!));
  let x = Math.round((1536 - ws.reduce((a, b) => a + b, 0) - 80) / 2);
  const comp = imgs.map((input, i) => { const o = { input, left: x, top: 160 }; x += ws[i] + 40; return o; });
  return sharp({ create: { width: 1536, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).png().toBuffer();
}
const prompt = [
  'Hand-painted Japanese emaki handscroll figures from about 1805, fine sumi ink outlines with delicate pale watercolour washes, exactly the same drawing style, line weight, colouring and scale as the three figures in the reference image.',
  'Draw THREE NEW, DIFFERENT Edo townsmen side by side in one row, evenly spaced, not overlapping, each a full figure walking towards the LEFT, the same height as the reference figures:',
  '(1) a hikyaku courier jogging briskly: a white headband, a short indigo kimono tucked up to the thighs, bare legs, straw sandals, a small lacquered letter box tied to the end of a short pole over his shoulder;',
  '(2) a carpenter: a work happi coat with a plain dark collar, tight work trousers, a headband, a wooden toolbox on his shoulder and an L-shaped carpenter\'s square in his other hand;',
  '(3) a candy seller: a cheerful man in a striped kimono and a small straw hat, a flat wooden tray of colourful sugar candies on sticks hung in front of him from a strap round his neck.',
  'No text, no writing anywhere. Each figure isolated on a fully transparent background: no ground, no shadow, no border.',
].join(' ');
const [out, n = '2'] = process.argv.slice(2);
if (!out) throw new Error('usage: tsx passers.mts <outdir> [n]');
const image = await ref();
await Promise.all(Array.from({ length: +n }, async (_, i) => {
  const form = new FormData();
  form.append('model', cfg.imageModel); form.append('prompt', prompt); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('background', 'transparent'); form.append('n', '1');
  form.append('image', new Blob([image], { type: 'image/png' }), 'image.png');
  try {
    const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), { method: 'POST', headers: { authorization: `Bearer ${cfg.apiKey}` }, body: form, signal: AbortSignal.timeout(300000) });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 160)}`);
    const item = JSON.parse(text)?.data?.[0];
    await writeFile(`${out}/sheet-${i}.png`, item?.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer()));
    console.log('ok', i);
  } catch (e) { console.log('FAIL', i, (e as Error).message); }
}));
