// 汴河拾光 long scroll: outpaint Codex's river-v1 (2172×724) to both sides with
// TokenStars gpt-image-2 (owner-approved). Each step keeps 512 px of what is
// painted and adds 1024 px; absolute positions in the frame hold the scale.
//   tsx cn-long.mts <outdir> base | right [R1 R2 ..] | left [L1 ..]
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { configFromEnv } from '/home/user/wonderlab/server/src/tokenstars.ts';

const require = createRequire('/home/user/wonderlab/package.json');
const sharp = require('sharp');
const W = 1536, H = 1024, KEEP = 512;
const cfg = configFromEnv();

const STYLE = [
  'Continuation of an original panoramic Chinese handscroll of an ordinary spring day along the Bian River in late',
  'Northern Song Bianjing, in the manner of the meticulous fine ink linework, pale mineral washes and elevated oblique',
  "dispersed viewpoint of Zhang Zeduan's Along the River During the Qingming Festival (an original new scene, not a",
  'copy). Fine irregular warm charcoal and tea-brown ink outlines, translucent layered watercolour and mineral',
  'pigment on warm pale unbleached silk-paper (#e9ddbd). Palette: warm gray ink, river gray-green #95a99a, willow',
  'gray-olive, weathered timber, restrained ochre, tiny muted cinnabar accents. Gentle morning light.',
  'Small individually drawn people in plausible Northern Song commoner robes and headwraps, at architectural scale.',
  'No drawn lettering, no calligraphy, no fake characters, no seals, no watermark, no frame. Hanging shop signs blank.',
  'NOT cartoon, NOT 3D, NOT photo, NOT ukiyo-e, no Japanese costume, no Qing yellow tiles, no pagoda stereotypes.',
].join(' ');
const ANCHOR = (side: 'right' | 'left') => [
  `CONTINUE THE PAINTING SEAMLESSLY TO THE ${side.toUpperCase()}. The ${side === 'right' ? 'left' : 'right'} part is already painted: match it exactly,`,
  'the same viewpoint, the same scale of buildings and people, the same horizon and haze, the same paper colour and light.',
  'KEEP THE SCALE FIXED: the faint distant town and trees stay in the top 15% of the picture; the roofs of the near',
  'buildings lie about 12-30% down; the near bank or street level is about 45-55% down; a standing person is about',
  'one ninth of the picture height. Buildings must not grow bigger or nearer towards the edge.',
].join(' ');
const RIVER = 'The river continues along the bottom of the picture, its water filling the band from about 58% down to the bottom edge, with ripples and reflections.';

const SECTIONS: Record<string, string> = {
  // going right: upstream, out of town towards the countryside
  R1: `${RIVER} A stone-stepped water landing (水埠) under old willows: women rinse cloth and wash vegetables on the steps, a small sampan is tied to a post; behind, a few houses with tiled roofs and a vegetable plot.`,
  R2: `${RIVER} A cargo harbour: two large flat-bottomed grain boats moored side by side with masts lowered; porters carry sacks over gangplanks to an open timber warehouse on the bank; a clerk tallies sacks under an awning.`,
  R3: `${RIVER} A small boatyard on the bank: a half-built wooden boat raised on trestles, carpenters planing planks and caulking seams, stacks of timber; a handcart with logs on the bank path.`,
  R4: `${RIVER} A riverside inn with an open timber terrace over the water, a few travellers drinking tea; a mule with packs is tied at the door; the houses become fewer.`,
  R5: `${RIVER} A water mill: a wooden water wheel turning beside a small mill house with a thatched roof; a farmer with sacks of grain on a donkey waits; bamboo grove behind.`,
  R6: `${RIVER} The edge of town: a willow-lined earthen road along the bank with thatched farmhouses, a fence of woven branches, chickens, and a small caravan of donkeys loaded with charcoal walking towards town.`,
  R7: `${RIVER} Early spring countryside: green young wheat fields in neat strips behind the bank, two farmers hoeing, a tiny ferry boat crossing the river with one passenger, a few low willows.`,
  R8: `${RIVER} The quiet beginning of the scroll: open river, misty willows on a low bank, a fisherman in a small boat, faint low hills in haze far away; the right edge fades into plain pale paper.`,
  // going left: downstream, across the bridge into the city
  L1: `${RIVER} The bank beyond the bridge foot: a lively cluster of stalls under large plain cloth parasols and awnings, a fortune-teller's table, a snack seller with a steaming pot, a crowd of pedestrians.`,
  L2: `${RIVER} A large two-storey riverside restaurant with an elaborate timber decorated gateway of bound poles in front (no writing), customers at tables on the upper floor balcony, servants carrying dishes.`,
  L3: `${RIVER} Workshops along the bank: a dyeing yard with long lengths of indigo and ochre cloth hanging on poles to dry, vats; next to it a carpenter's shed with men sawing a beam.`,
  L4: `The river turns away towards the bottom right and narrows, its stone embankment curving off; in its place a broad earthen road fills the lower half of the picture, with an ox cart loaded with goods, porters, a sedan chair carried by two men, and a row of shops behind.`,
  L5: `A broad earthen road fills the lower half. A tall city gate: a massive sloping rammed-earth city wall with a timber gate tower on top and a deep gateway arch, a camel caravan walking through the gate, guards and travellers.`,
  L6: `A broad earthen road fills the lower half. Inside the city: a street of shops with open fronts: a medicine shop with herb drawers and blank hanging signs, a silk shop with folded bolts, a bow and arrow maker; townspeople shopping.`,
  L7: `A broad earthen road fills the lower half. A small temple gate with a courtyard and old trees behind a wall; in front a public well where people draw water with a windlass; a barber shaving a customer at a stool.`,
  L8: `A broad earthen road fills the lower half. Quiet residential lanes: courtyard houses behind plastered walls with gates, a scholar reading at a window, a child with a kite, flowering peach trees.`,
  L9: `A broad earthen road fills the lower half, becoming quieter. The city thins: a narrow canal with a small stone bridge and two willows, open ground; the left edge fades into plain pale paper.`,
};

async function edit(image: Buffer, mask: Buffer, prompt: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const form = new FormData();
    form.append('model', cfg.imageModel);
    form.append('prompt', prompt);
    form.append('size', `${W}x${H}`);
    form.append('quality', 'high');
    form.append('n', '1');
    form.append('image', new Blob([image], { type: 'image/png' }), 'image.png');
    form.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');
    try {
      const res = await fetch(new URL('/v1/images/edits', cfg.baseUrl), { method: 'POST', headers: { authorization: `Bearer ${cfg.apiKey}` }, body: form, signal: AbortSignal.timeout(400000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
      const item = JSON.parse(text)?.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
      if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
      throw new Error('no image in response');
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log('retry', attempt, String(e).slice(0, 120));
    }
  }
}

/** A 1536 frame: the kept 512 px of the neighbour on one side, the rest open. */
async function frame(prev: Buffer, side: 'right' | 'left') {
  const { width } = await sharp(prev).metadata();
  const strip = await sharp(prev).extract({ left: side === 'right' ? width - KEEP : 0, top: 0, width: KEEP, height: H }).png().toBuffer();
  const at = side === 'right' ? 0 : W - KEEP;
  const empty = { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const image = await sharp({ create: empty }).composite([{ input: strip, left: at, top: 0 }]).png().toBuffer();
  const keep = await sharp({ create: { width: KEEP, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  const mask = await sharp({ create: empty }).composite([{ input: keep, left: at, top: 0 }]).png().toBuffer();
  return { image, mask };
}

const [out, what, ...only] = process.argv.slice(2);
if (what === 'base') {
  await sharp('/home/user/wonderlab/apps/qingming-china/public/art/china/river-v1.webp').resize(Math.round(2172 * H / 724), H).png().toFile(`${out}/base.png`);
  console.log('base written');
} else {
  const side = what as 'right' | 'left';
  const all = side === 'right' ? ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'] : ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'];
  const run = only.length ? only : all;
  for (const s of run) {
    const i = all.indexOf(s);
    const prevFile = i === 0 ? `${out}/base.png` : `${out}/${all[i - 1]}.png`;
    if (existsSync(`${out}/${s}.png`)) { console.log(s, 'exists'); continue; }
    const t0 = Date.now();
    const { image, mask } = await frame(await readFile(prevFile), side);
    const png = await edit(image, mask, `${STYLE} ${ANCHOR(side)} ${SECTIONS[s]}`);
    await writeFile(`${out}/${s}.png`, png);
    console.log(side, s, Math.round(png.length / 1024), 'KB', Math.round((Date.now() - t0) / 1000), 's');
  }
}
