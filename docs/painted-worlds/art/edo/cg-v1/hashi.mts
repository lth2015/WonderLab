// 橋のたもと (event picture): everyone gathered at the bridge foot for one picture.
// The reference is a group made of the people's own street sprites, so each keeps their
// clothes; the painting places them at the foot of the arched bridge. gpt-image-2 edits.
//   tsx hashi.mts <outdir> [n]
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';

const cfg = configFromEnv();
const ART = '/home/user/wonderlab/apps/qingming-edo/src/assets/art';
// back row, then front row (left to right), heights in px on the 1024×1536 reference
const BACK = ['okon-hold', 'kisuke-teapot', 'sokichi-nod', 'crowd1-merchant', 'seita-stand'];
const FRONT = ['kinji-rest', 'oharu-ask', 'kame-point', 'omatsu-smile'];

async function group(): Promise<Buffer> {
  // a child and an old woman stand smaller, as they are
  const SCALE: Record<string, number> = { 'kame-point': 0.68, 'omatsu-smile': 0.9, 'kinji-rest': 0.85 };
  const layer = async (ids: string[], h: number, y: number) => {
    const imgs = await Promise.all(ids.map(async (id) => sharp(await readFile(`${ART}/${id}.webp`)).resize({ height: Math.round(h * (SCALE[id] ?? 1)) }).png().toBuffer()));
    const widths = await Promise.all(imgs.map(async (b) => (await sharp(b).metadata()).width!));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.round((1024 - total) / 2);
    return imgs.map((input, i) => {
      const o = { input, left: Math.max(0, x), top: y + (h - Math.round(h * (SCALE[ids[i]] ?? 1))) };
      x += widths[i];
      return o;
    });
  };
  const back = await layer(BACK, 330, 820);
  const front = await layer(FRONT, 300, 1000);
  return sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([...back, ...front])
    .png()
    .toBuffer();
}

const prompt = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes on warm pale paper. Strictly no text of any kind. Not anime, not 3D, not photograph.',
  'The reference image shows a group of townspeople (their small full-figure drawings). Paint THESE SAME PEOPLE, keeping each one\'s clothes, colours, hair and pose,',
  'standing together in two loose rows on an open earthen square at the foot of a wooden arched bridge (Nihonbashi) in early afternoon spring light, as if posing for a painter.',
  'Behind them: the bridge arching over the river, willow, tiled shop roofs, soft sky. The group in the lower half, about the size shown; a calm, warm, gathered feeling.',
  'Back row, left to right: a woman shopkeeper in an indigo striped kimono with a white apron holding a wrapped bundle; a plump balding tea-house master in an ochre kimono with a dark apron;',
  'an old painter with grey hair in a grey kimono; a clerk in a dark kimono; a slim young paper-shop clerk in a pale blue striped kimono.',
  'Front row, left to right: a young peddler with a white twisted headband crouching beside two baskets; a teenage girl in a pink kimono;',
  'a SMALL BOY about eight years old (child-sized, round face, small topknot, short brown kimono, bare legs) pointing excitedly; a small elderly GRANDMOTHER with grey hair in an indigo-and-grey striped kimono. Exactly nine people.',
  'Vertical composition. No extra people in front of the group.',
].join(' ');

const [out, n = '2'] = process.argv.slice(2);
if (!out) throw new Error('usage: tsx hashi.mts <outdir> [n]');
const ref = await group();
await writeFile(`${out}/hashi-ref.png`, ref);
await Promise.all(
  Array.from({ length: +n }, async (_, i) => {
    const form = new FormData();
    form.append('model', cfg.imageModel);
    form.append('prompt', prompt);
    form.append('size', '1024x1536');
    form.append('quality', 'high');
    form.append('n', '1');
    form.append('image', new Blob([ref], { type: 'image/png' }), 'image.png');
    try {
      const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), { method: 'POST', headers: { authorization: `Bearer ${cfg.apiKey}` }, body: form, signal: AbortSignal.timeout(300000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      const item = JSON.parse(text)?.data?.[0];
      const buf = item?.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
      await writeFile(`${out}/hashi-${i}.png`, buf);
      console.log('ok', i);
    } catch (e) {
      console.log('FAIL', i, (e as Error).message);
    }
  }),
);
