#!/usr/bin/env node
// Subset LXGW WenKai (SIL OFL 1.1) to the characters the app can show in it:
// the echo library and the poetic UI copy (docs/03 §4). Rerun whenever
// src/poems.ts or that copy changes:  node scripts/subset-font.mjs
//
// The full font (~19 MB) is downloaded once into node_modules/.cache and is
// never committed; only the subset is.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import subsetFont from 'subset-font';

const VERSION = 'v1.330';
const URL = `https://github.com/lxgw/LxgwWenKai/releases/download/${VERSION}/LXGWWenKai-Regular.ttf`;
const CACHE = 'node_modules/.cache/wenkai';
const SOURCE = process.env.WENKAI_TTF || `${CACHE}/LXGWWenKai-Regular-${VERSION}.ttf`;
const OUT = 'src/assets/fonts/wenkai-subset.woff2';
const FILES = ['src/poems.ts', 'src/App.tsx', 'src/Menu.tsx'];

if (!existsSync(SOURCE)) {
  console.log(`Downloading ${URL}`);
  await mkdir(CACHE, { recursive: true });
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await writeFile(SOURCE, Buffer.from(await res.arrayBuffer()));
}

const chars = new Set(' 0123456789·—…、，。？！：；「」《》“”（）'.split(''));
for (const f of FILES) for (const ch of await readFile(f, 'utf8')) if (ch.charCodeAt(0) > 0x2e7f) chars.add(ch);
const text = [...chars].join('');
const subset = await subsetFont(await readFile(SOURCE), text, { targetFormat: 'woff2' });
await mkdir('src/assets/fonts', { recursive: true });
await writeFile(OUT, subset);
console.log(`${chars.size} characters → ${OUT} (${Math.round(subset.length / 1024)} KB)`);
