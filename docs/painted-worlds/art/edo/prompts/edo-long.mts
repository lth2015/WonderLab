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

// Outpainting drifted towards larger buildings section by section. Absolute
// positions in the frame (measured on section A) hold the scale in place.
const ANCHOR = [
  'KEEP THE SCALE FIXED: in the new part, exactly as in the painted part, the roof ridges lie about 30% down from the',
  'top of the picture, the eaves of the ground floor about 55% down, the front edges of the raised shop floors about',
  '73% down, and the earthen street fills the band from about 75% down to the bottom edge. Buildings must not get',
  'bigger or nearer towards the left; a person would be about one eighth of the picture height.',
].join(' ');
const MID_SECTIONS: Record<string, string> = {
  E: `${CONT} ${ANCHOR} Going left: a ceramics shop with stacks of bowls, plates and jars on stepped shelves; then a narrow lane whose far end shows a small vermilion shrine gate.`,
  F: `${CONT} ${ANCHOR} Going left: a large merchant house with a long row of plain dark-indigo noren (no crests, no writing), a wide raised shop floor with low counters and folded cloth bales; a white earthen-walled storehouse with a heavy tiled roof just behind it.`,
  G: `${CONT} ${ANCHOR} Going left: a wooden ward gate (kido) standing across the street — two tall posts and a beam with roof, its doors open — with a small guard hut (bansho) at its side; the row of houses continues beyond it.`,
  H: `${CONT} ${ANCHOR} Going left: a print and book shop with picture prints hung on strings (no readable writing) and stacks of bound books; then a medicine shop with large paper bags hanging under the eaves and walls of small wooden drawers.`,
  I: `${CONT} ${ANCHOR} Going left: a well-head with a wooden frame and bucket in front of the houses; a cooper's shop with new barrels and tubs and hoops of bamboo; a small stall of straw sandals hanging in rows.`,
  J: `${CONT} ${ANCHOR} Going left: a fan and umbrella shop with oiled-paper umbrellas opened along its front; behind the roofs rises a tall wooden fire-watch tower with a ladder and a small bell.`,
  K: `${CONT} ${ANCHOR} Going left: a sake shop with straw-wrapped sake barrels stacked by the door and a round ball of cedar branches hanging from the eaves; then a small rice-cracker shop with a charcoal grill.`,
  L: `${CONT} ${ANCHOR} Going left: a timber yard with logs and boards stacked upright against a frame, then the row of houses thins out with a fence and a few trees.`,
  M: `${CONT} ${ANCHOR} Going left: the street ends at a short wooden bridge over a narrow canal with stone banks and two willows; beyond the canal only a little open ground, then plain paper at the left edge.`,
};

const FAR = [
  INK,
  'A distant view only, very pale and faint, in light grey-blue distant ink (#96917d) with almost no colour: low',
  'rows of distant tiled roofs of a city seen far away, a few clumps of distant trees, one wooden fire-watch tower,',
  'the faint line of a far storehouse wall. Everything sits in the lower middle of the picture as a thin band; the',
  'upper half is plain pale paper with two or three very thin wisps of pale gold mist. No people, no animals, no',
  'river in the foreground, nothing near the viewer. Horizontal, continuous, like the background of a handscroll.',
].join(' ');
const FAR_NEXT = `${FAR} Continue the same distant view seamlessly to the left, same height and paleness.`;
const FAR_SECTIONS: Record<string, string> = {
  D: FAR_NEXT,
  E: `${FAR_NEXT} Very faint and small on the far horizon, the snowy cone of Mount Fuji.`,
  F: FAR_NEXT,
  G: FAR_NEXT,
  H: FAR_NEXT,
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

const CROWD = (who: string) =>
  [
    INK,
    `A sheet of FOUR DIFFERENT Edo-period townspeople, each drawn once, side by side, evenly spaced and not`,
    `overlapping, all at the same scale and all walking towards the LEFT, seen from the same slightly elevated`,
    `three-quarter view: ${who}. Full figures, nothing cut off. Each figure isolated on a fully transparent`,
    'background: no ground, no shadow, no paper texture behind them, no border.',
  ].join(' ');
const CHARS: Record<string, string> = {
  crowd1: CROWD('a merchant in a dark haori carrying an abacus wrapped in cloth; a townswoman holding a closed paper parasol; a porter bent under a large bundle tied on his back; an old monk with a deep straw hat and a staff'),
  crowd2: CROWD('a samurai in hakama with two swords, holding a folded fan; a young shop apprentice carrying a stack of wooden boxes; a fishmonger with a shallow tub on each end of a shoulder pole; an old woman walking slowly with a cane'),
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
  const all = prefix === 'mid' ? 'ABCDEFGHIJKLM'.split('') : 'ABCDEFGH'.split('');
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
