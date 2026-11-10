// 物語の画, second set: 茶店の猫 (two endings, こはく from its own sprite) and 朝の藍.
//   tsx cg2.mts <outdir> <neko-bench|neko-boat|ai> [n]
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';

const cfg = configFromEnv();
const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey) on warm pale paper.',
  'Strictly no text of any kind: no writing on curtains, signs, cloths or boats. Not anime, not 3D, not photograph. Vertical composition.',
].join(' ');
const CAT = 'The reference image shows the cat: a small calico cat (white with orange and black patches). Paint THIS SAME cat, same markings.';
const P: Record<string, { prompt: string; cat?: boolean }> = {
  'neko-bench': { cat: true, prompt: [INK, CAT,
    'In front of an Edo tea house in soft spring sunlight: the cat is curled up asleep on a sunny patch of the earthen street beside a red-felt bench,',
    'a teacup on the bench, plain noren behind; warm, quiet, sleepy. The cat in the lower middle, about a sixth of the picture wide.'].join(' ') },
  'neko-boat': { cat: true, prompt: [INK, CAT,
    'Seen from behind: the small cat sits on the top of old stone steps leading down to a calm moat, looking at a small moored wooden boat and the water;',
    'willow branches, stone embankment, soft morning light. The cat small in the lower middle, its back to the viewer.'].join(' ') },
  ai: { prompt: [INK,
    'Early morning at an Edo indigo dyer\'s drying yard: long cloths hung on tall bamboo poles in many shades of indigo, from deep almost-black blue to pale sky blue,',
    'stirring slightly in the breeze; in the foreground, the rims of two large indigo vats with a faint blue froth; low tiled roofs behind, soft slanting morning light. No people.'].join(' ') },
};

async function catRef(): Promise<Buffer> {
  const fig = await sharp(await readFile('/home/user/wonderlab/apps/qingming-edo/src/assets/art/neko-loaf.webp')).resize({ width: 420 }).png().toBuffer();
  return sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fig, gravity: 'center' }]).png().toBuffer();
}

async function draw(id: string): Promise<Buffer> {
  const { prompt, cat } = P[id];
  if (!cat) {
    const { generateImage } = await import('/home/user/wonderlab/server/src/tokenstars.ts');
    return generateImage(cfg, { prompt, size: '1024x1536', quality: 'high' });
  }
  const form = new FormData();
  form.append('model', cfg.imageModel); form.append('prompt', prompt); form.append('size', '1024x1536'); form.append('quality', 'high'); form.append('n', '1');
  form.append('image', new Blob([await catRef()], { type: 'image/png' }), 'image.png');
  const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), { method: 'POST', headers: { authorization: `Bearer ${cfg.apiKey}` }, body: form, signal: AbortSignal.timeout(300000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  const item = JSON.parse(text)?.data?.[0];
  return item?.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
}

const [out, id, n = '2'] = process.argv.slice(2);
if (!out || !P[id]) throw new Error('usage: tsx cg2.mts <outdir> <neko-bench|neko-boat|ai> [n]');
await Promise.all(Array.from({ length: +n }, async (_, i) => {
  try { await writeFile(`${out}/${id}-${i}.png`, await draw(id)); console.log('ok', id, i); } catch (e) { console.log('FAIL', id, i, (e as Error).message); }
}));
