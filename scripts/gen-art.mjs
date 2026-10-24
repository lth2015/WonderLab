#!/usr/bin/env node
// One-off art generation: koi and moon textures for the engine, made once
// through TokenStars and committed as static files (public/art). Nothing is
// generated at run time, so players never cost anything (docs/01 P7, P9).
//
//   npm run art --                 # show the plan and estimated cost
//   npm run art -- --yes           # generate everything
//   npm run art -- --yes --only kohaku,moon
//   npm run art -- --process-only  # images you made yourself (e.g. in the
//                                  # ChatGPT app) saved as art-raw/<name>.png
//   npm run art -- --prompts       # print the prompts to paste into ChatGPT
//
// Needs TOKENSTARS_API_KEY and TOKENSTARS_IMAGE_MODEL_ID, from .env or the
// environment (see .env.example).
// Raw downloads go to art-raw/ (not committed); processed textures and
// public/art/manifest.json are what the app loads.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { configFromEnv, generateImage } from '../server/src/tokenstars.ts';

// Read TOKENSTARS_* from a local .env (same names as yuha), if there is one.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the environment.
}

const RAW = 'art-raw';
const OUT = 'public/art';
const MANIFEST = `${OUT}/manifest.json`;

// List-price estimate per image (USD) for an OpenAI gpt-image-class model at
// medium quality. TokenStars' discounted rate is lower; this is a ceiling.
const EST_USD = { '1536x1024': 0.063, '1024x1024': 0.042 };

const KOI_STYLE = [
  'Photorealistic overhead photograph of a single live koi, shot from directly above, as',
  'it would look swimming just under clear water. Natural soft daylight from above; real',
  'scales with a subtle pearly sheen and fine variation, wet skin with gentle specular',
  'highlights along the back, true three-dimensional body volume with soft shading toward',
  'the flanks, realistic colour that is slightly uneven like a living fish, not flat paint.',
  'The body is straight and horizontal, the HEAD POINTING TO THE RIGHT, centred, the fish',
  'spanning about 90% of the image width, seen strictly from above (dorsal view, both eyes',
  'visible). Pectoral fins spread to both sides, the tail fin open; all fins thin, delicate',
  'and partly translucent with fine ray lines. Not an illustration, not a drawing, no',
  'outlines. Isolated on a fully transparent background: no water, no ripples, no shadow,',
  'no other objects, no text, no border.',
].join(' ');

const KOI = [
  { name: 'kohaku', look: 'Kohaku: porcelain-white body with large vermilion red patches on the back, a red patch on the head.' },
  { name: 'sanke', look: 'Taisho sanke: white body with vermilion red patches and small crisp black sumi ink markings on the back.' },
  { name: 'showa', look: 'Showa: deep ink-black body with bold vermilion red and white patches, black wrapping around the pectoral fin bases.' },
  { name: 'tancho', look: 'Tancho: pure white body with a single round vermilion red crown on the top of the head, nothing else red.' },
  { name: 'ogon', look: 'Ogon: a single soft pale-gold colour, metallic scales catching the light, fins pale gold.' },
  { name: 'asagi', look: 'Asagi: blue-grey scales with a pale net pattern on the back, warm orange along the sides, cheeks and fin bases.' },
  { name: 'sumi', look: 'Karasu / sumi koi: a deep charcoal-black body with soft grey and a little white on the belly edges and fin tips.' },
];

const MOON = {
  name: 'moon',
  prompt: [
    'The full moon as a single disc, with true lunar detail: the dark maria, bright highlands,',
    'craters and the faint ray systems, rendered with the soft texture of traditional Chinese',
    'ink wash on rice paper, warm pale ivory tones. The disc is perfectly circular, centred,',
    'touching the edges of the image. Pure black everywhere outside the disc: no glow, no halo,',
    'no stars, no clouds, no text.',
  ].join(' '),
};

const JOBS = [
  ...KOI.map((k) => ({ kind: 'koi', name: k.name, size: '1536x1024', background: 'transparent', prompt: `${KOI_STYLE} ${k.look}` })),
  { kind: 'moon', name: MOON.name, size: '1024x1024', background: 'opaque', prompt: MOON.prompt },
];

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const processOnly = args.includes('--process-only');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1]).split(',') : null;
const jobs = only ? JOBS.filter((j) => only.includes(j.name)) : JOBS;

if (args.includes('--prompts')) {
  for (const j of jobs) console.log(`## ${j.name} (${j.size}${j.kind === 'koi' ? ', transparent background' : ''}) → save as ${RAW}/${j.name}.png\n${j.prompt}\n`);
  process.exit(0);
}

const total = jobs.reduce((sum, j) => sum + EST_USD[j.size], 0);
console.log(`${jobs.length} image(s), estimated at most $${total.toFixed(2)} at list price:`);
for (const j of jobs) console.log(`  ${j.name.padEnd(8)} ${j.size}  ~$${EST_USD[j.size]}`);
if (!yes && !processOnly) {
  console.log('\nDry run. Add --yes to generate.');
  process.exit(0);
}

const cfg = configFromEnv();
await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : { version: 1, koi: [], moon: null };

for (const job of jobs) {
  let raw;
  if (processOnly) {
    if (!existsSync(`${RAW}/${job.name}.png`)) continue;
    process.stdout.write(`${job.name}: processing… `);
    raw = await readFile(`${RAW}/${job.name}.png`);
  } else {
    process.stdout.write(`${job.name}: generating… `);
    raw = await generateImage(cfg, { prompt: job.prompt, size: job.size, background: job.background === 'transparent' ? 'transparent' : undefined });
    await writeFile(`${RAW}/${job.name}.png`, raw);
  }
  if (job.kind === 'koi') {
    const entry = await processKoi(raw, job.name);
    manifest.koi = [...manifest.koi.filter((k) => k.name !== job.name), entry];
    console.log(`ok (half width ${entry.halfWidth})`);
  } else {
    manifest.moon = await processMoon(raw);
    console.log('ok');
  }
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`\nWrote ${MANIFEST}. Check each texture faces right (head on the right); set "flip": true in the manifest for any that do not.`);

/** Trim to the fish, keep it facing right, record its proportions for the ribbon. */
async function processKoi(raw, name) {
  let img = sharp(await keyOutBackground(raw)).ensureAlpha();
  img = sharp(await img.trim({ threshold: 8 }).png().toBuffer());
  const resized = img.resize({ width: 1024, withoutEnlargement: true });
  const { data, info } = await resized.webp({ quality: 88, alphaQuality: 90 }).toBuffer({ resolveWithObject: true });
  await writeFile(`${OUT}/koi-${name}.webp`, data);
  // Half the image height over its length: how wide the ribbon must be.
  return { name, file: `koi-${name}.webp`, halfWidth: +(info.height / (2 * info.width)).toFixed(3), flip: false };
}

/** Square crop on the disc, with everything outside the circle transparent. */
async function processMoon(raw) {
  const trimmed = await sharp(raw).trim({ background: '#000000', threshold: 24 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const side = Math.min(meta.width, meta.height);
  const disc = Buffer.from(`<svg width="512" height="512"><circle cx="256" cy="256" r="255" fill="#fff"/></svg>`);
  const data = await sharp(trimmed)
    .extract({ left: Math.floor((meta.width - side) / 2), top: Math.floor((meta.height - side) / 2), width: side, height: side })
    .resize(512, 512)
    .ensureAlpha()
    .composite([{ input: disc, blend: 'dest-in' }])
    .webp({ quality: 90 })
    .toBuffer();
  await writeFile(`${OUT}/moon.webp`, data);
  return { file: 'moon.webp' };
}

/**
 * If the model ignored the transparent-background request, remove a plain
 * light background. Only light pixels connected to the image border are
 * removed (a flood fill), so a white koi body is never punched through.
 */
async function keyOutBackground(raw) {
  const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let opaqueCorners = 0;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    if (data[(y * w + x) * 4 + 3] > 250) opaqueCorners++;
  }
  if (opaqueCorners < 3) return raw; // already transparent
  const at = (x, y) => (y * w + x) * 4;
  const c0 = at(0, 0);
  const bg = [data[c0], data[c0 + 1], data[c0 + 2]];
  const isBg = (i) => Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 40;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1);
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y);
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
    seen[y * w + x] = 1;
    const i = at(x, y);
    if (!isBg(i)) continue;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // Soften the cut by one pixel.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = at(x, y);
      if (data[i + 3] === 0) continue;
      if (!data[at(x + 1, y) + 3] || !data[at(x - 1, y) + 3] || !data[at(x, y + 1) + 3] || !data[at(x, y - 1) + 3]) data[i + 3] = 160;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
