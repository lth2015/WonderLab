// ご隠居 redrawn as an old MAN (owner 2026-11-04: the old sprite read as an old woman while
// every line is his: わし, his late wife). Same pose, scale and palette as the old
// crowd2-elder sprite, which is passed as the reference image. TokenStars gpt-image-2 edits.
//   tsx elder.mts <outdir> [n]     # writes elder-<i>.png (1024x1536, transparent)
import { readFile, writeFile } from 'node:fs/promises';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';
import sharp from 'sharp';

const cfg = configFromEnv();
const OLD = '/home/user/wonderlab/apps/qingming-edo/src/assets/art/crowd2-elder.webp';
const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey)',
  'on warm pale paper. Clear readable detail. Strictly no text of any kind. No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');
const prompt = [
  INK,
  'Redraw the figure in the reference image as an elderly retired Edo MERCHANT GENTLEMAN (goinkyo) in his mid seventies:',
  'a MAN, white thinning hair tied in a small old man\'s topknot (chonmage) on top of a partly bald head, a thin kindly lined face, a short white beard stubble,',
  'a little stooped, walking slowly to the left leaning on a plain wooden walking stick held in his right hand, exactly the same pose, direction and proportions as the reference.',
  'Clothing: a muted sage-green haori jacket with a small pale flower pattern worn over a brown pinstriped kimono, a dark obi, white tabi socks and straw zori sandals;',
  'a small faded indigo tenugui hand towel with a wave pattern tucked into his obi at the hip; a small dark-blue cloth pouch in his left hand.',
  'One single full figure, nothing cut off, isolated on a fully transparent background: no ground, no shadow, no paper texture, no border.',
].join(' ');

async function ref(): Promise<Buffer> {
  const fig = await sharp(await readFile(OLD)).resize({ height: 1300, kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fig, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function draw(): Promise<Buffer> {
  const form = new FormData();
  form.append('model', cfg.imageModel);
  form.append('prompt', prompt);
  form.append('size', '1024x1536');
  form.append('quality', 'high');
  form.append('background', 'transparent');
  form.append('n', '1');
  form.append('image', new Blob([await ref()], { type: 'image/png' }), 'image.png');
  const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(300000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
  const item = JSON.parse(text)?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error('no image');
}

const [out, n = '3'] = process.argv.slice(2);
if (!out) throw new Error('usage: tsx elder.mts <outdir> [n]');
await Promise.all(
  Array.from({ length: +n }, async (_, i) => {
    try {
      await writeFile(`${out}/elder-${i}.png`, await draw());
      console.log('ok', i);
    } catch (e) {
      console.log('FAIL', i, (e as Error).message);
    }
  }),
);
