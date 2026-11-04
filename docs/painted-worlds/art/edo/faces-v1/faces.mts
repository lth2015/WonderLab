// 立ち絵 (dialogue portraits): one head-and-shoulders bust per named person, painted from their
// street sprite (passed as the reference image) so face, hair and clothing stay the same person.
// TokenStars gpt-image-2 /v1/images/edits, same INK wording as ../kashi-v1/kashi.mts.
//   tsx faces.mts <outdir> [id...]     # writes face-<id>.png (1024², transparent)
import { readFile, writeFile } from 'node:fs/promises';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';
import sharp from 'sharp';

const cfg = configFromEnv();
const ART = '/home/user/wonderlab/apps/qingming-edo/src/assets/art';
const INK = [
  'Hand-painted Japanese emaki handscroll from about 1805, in the manner of a detailed Edo-period street scroll:',
  'fine sumi ink outlines with delicate pale watercolour washes (light indigo, persimmon, ochre, soft green, grey)',
  'on warm pale paper. Clear readable detail. Strictly no text of any kind. No modern objects. Not anime, not 3D render, not photograph.',
].join(' ');

const WHO: Record<string, [sprite: string, who: string, mood: string]> = {
  sokichi: ['sokichi-nod', 'an old Edo painter-master in his sixties, grey hair in a small topknot, lean lined face', 'calm, quietly watchful, the faintest smile'],
  seita: ['seita-stand', 'a young Edo paper-shop clerk about eighteen, neat topknot, slim gentle face', 'polite and a little earnest'],
  okon: ['okon-hold', 'an Edo tool-shop proprietress in her thirties, hair in a neat married-woman bun with a comb', 'warm, brisk and capable'],
  kisuke: ['kisuke-teapot', 'a plump Edo tea-house master in his fifties, balding with a small topknot, round kind face', 'genial, welcoming smile'],
  kinji: ['kinji-walk', 'a young Edo street peddler in his twenties, a white twisted headband, tanned cheerful face', 'lively grin'],
  oharu: ['oharu-ask', 'an Edo errand girl about sixteen, hair up with a small red ornament, soft round face', 'gentle and attentive'],
  omatsu: ['omatsu-smile', 'an elderly Edo fishwife in her late sixties, grey hair tied up simply, wrinkled kind face', 'warm grandmotherly smile'],
  kamekichi: ['kame-point', 'an Edo boy about eight years old, round face, short hair with a small topknot', 'bright, mischievous grin'],
  ihei: ['crowd1-merchant', 'an Edo money-changer\'s clerk in his thirties, tidy topknot, thoughtful face', 'courteous, a little homesick'],
  inkyo: ['crowd2-elder', 'a retired Edo old gentleman in his seventies, white hair, thin face', 'mild and kindly'],
};

async function ref(sprite: string): Promise<Buffer> {
  const img = sharp(await readFile(`${ART}/${sprite}.webp`)).resize({ height: 900, kernel: 'lanczos3' });
  const fig = await img.png().toBuffer();
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fig, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function face(id: string): Promise<Buffer> {
  const [sprite, who, mood] = WHO[id];
  const prompt = [
    INK,
    `The reference image is a small full-figure drawing of ${who}. Paint a head-and-shoulders BUST PORTRAIT of this SAME person:`,
    'the identical face, hairstyle, hair ornament and the same kimono colours and pattern at the collar and shoulders.',
    `Expression: ${mood}. Seen from the front, turned very slightly to the left, eyes towards the viewer.`,
    'Head and upper chest only, centred, the head filling about the upper half, cut off softly at mid-chest.',
    'Isolated on a fully transparent background: no paper texture behind, no border, no frame, no shadow.',
  ].join(' ');
  const form = new FormData();
  form.append('model', cfg.imageModel);
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('quality', 'high');
  form.append('background', 'transparent');
  form.append('n', '1');
  form.append('image', new Blob([await ref(sprite)], { type: 'image/png' }), 'image.png');
  const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(300000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status} ${text.slice(0, 300)}`);
  const item = JSON.parse(text)?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error(`${id}: no image`);
}

const [out, ...only] = process.argv.slice(2);
if (!out) throw new Error('usage: tsx faces.mts <outdir> [id...]');
const ids = only.length ? only : Object.keys(WHO);
await Promise.all(
  ids.map(async (id) => {
    try {
      await writeFile(`${out}/face-${id}.png`, await face(id));
      console.log('ok', id);
    } catch (e) {
      console.log('FAIL', (e as Error).message);
    }
  }),
);
