// Makes the run-time art for section 1 (hashizume, scene x 2000–3000) of 清明上河図：江戸編.
//   - section background: the right 1463 px of the stitched, graded street (1000 × 700 scene units)
//   - characters: each sheet cut in thirds, trimmed by alpha, toned to the background's wash
// Output: apps/qingming-edo/src/assets/art/*.webp, and a contact sheet in the scratchpad.
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const S = '/tmp/claude-0/-home-user-wonderlab/ec2033cc-b1cd-5687-b5c6-3d575ad20284/scratchpad';
const OUT = '/home/user/wonderlab/apps/qingming-edo/src/assets/art';
const STRIP_W = 3584, H = 1024;
const SEC_PX = Math.round((1000 * H) / 700); // 1463 px = 1000 units
const GAIN = [1.191, 1.25, 1.353]; // the strip's grade (art/edo/README.md)

// px of the sheet → px of the background, so a standing person matches the
// background's passers-by (~210 px tall at 1024)
// 90 scene units (style decision v1 #4) at 1024/700 px per unit
const STAND_BG_PX = 90 * (1024 / 700);

async function sheet(name, poses) {
  const f = require('fs').existsSync(`${S}/r2/edo-${name}-01.png`) ? `${S}/r2/edo-${name}-01.png` : `${S}/edo-${name}-01.png`;
  const { width: W, height: SH } = await sharp(f).metadata();
  // Split on the empty columns between figures (equal thirds cut through a
  // sketchbook held out to the side). Slivers merge into the nearest figure.
  const { data: alpha } = await sharp(f).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const used = Array.from({ length: W }, (_, x) => {
    for (let y = 0; y < SH; y += 2) if (alpha[y * W + x] > 12) return true;
    return false;
  });
  let segs = [];
  for (let x = 0; x < W; x++) {
    if (!used[x]) continue;
    const a = x;
    while (x < W && used[x]) x++;
    segs.push([a, x]);
  }
  while (segs.length > 3) {
    // merge the narrowest segment into its nearer neighbour
    let i = 0;
    segs.forEach((s, j) => { if (s[1] - s[0] < segs[i][1] - segs[i][0]) i = j; });
    const left = i > 0 ? segs[i][0] - segs[i - 1][1] : Infinity;
    const right = i < segs.length - 1 ? segs[i + 1][0] - segs[i][1] : Infinity;
    const j = left <= right ? i - 1 : i + 1;
    const m = [Math.min(segs[i][0], segs[j][0]), Math.max(segs[i][1], segs[j][1])];
    segs = segs.filter((_, k) => k !== i && k !== j);
    segs.push(m);
    segs.sort((p, q) => p[0] - q[0]);
  }
  let figureMasks = null;
  if (segs.length !== 3) {
    // Figures overlap in columns (a carrying pole, a basket) but are separate in 2D:
    // label connected components, keep the three largest as figures, give every
    // smaller piece to the figure whose box centre is nearest.
    const lab = new Int32Array(W * SH).fill(-1);
    const comps = [];
    for (let i = 0; i < W * SH; i++) {
      if (lab[i] >= 0 || alpha[i] <= 12) continue;
      const id = comps.length, st = [i];
      let n = 0, x0 = W, x1 = 0, y0 = SH, y1 = 0;
      lab[i] = id;
      while (st.length) {
        const p = st.pop(), x = p % W, y = (p / W) | 0;
        n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (const q of [p - 1, p + 1, p - W, p + W]) {
          if (q < 0 || q >= W * SH || lab[q] >= 0 || alpha[q] <= 12) continue;
          if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
          lab[q] = id; st.push(q);
        }
      }
      comps.push({ id, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
    const big = [...comps].sort((a, b) => b.n - a.n).slice(0, 3).sort((a, b) => a.cx - b.cx);
    const owner = new Int8Array(comps.length);
    for (const c of comps) {
      let best = 0;
      big.forEach((g, k) => { if (Math.hypot(c.cx - g.cx, c.cy - g.cy) < Math.hypot(c.cx - big[best].cx, c.cy - big[best].cy)) best = k; });
      owner[c.id] = best;
    }
    figureMasks = [0, 1, 2].map((k) => {
      const m = Buffer.alloc(W * SH);
      for (let i = 0; i < W * SH; i++) if (lab[i] >= 0 && owner[lab[i]] === k) m[i] = 255;
      return m;
    });
    console.log(name + ': figures overlap in columns; split by connected components (' + comps.length + ' pieces)');
    segs = [[0, W], [0, W], [0, W]];
  }
  const cuts = [];
  for (const [k, [a, b]] of segs.entries()) {
    let src = f;
    if (figureMasks) {
      // this figure only: its own pixels keep their alpha, everything else is cleared
      const { data: rgba } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < W * SH; i++) if (!figureMasks[k][i]) rgba[i * 4 + 3] = 0;
      src = await sharp(rgba, { raw: { width: W, height: SH, channels: 4 } }).png().toBuffer();
    }
    const part = await sharp(src).extract({ left: a, top: 0, width: b - a, height: SH }).png().toBuffer();
    cuts.push(await sharp(part).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer({ resolveWithObject: true }));
  }
  // scale from the standing pose (the tallest), the same factor for all three
  const k = STAND_BG_PX / Math.max(...cuts.map((c) => c.info.height));
  const meta = {};
  for (let i = 0; i < 3; i++) {
    const c = cuts[i];
    // 2× the background's pixel density, for sharp phones
    const w = Math.round(c.info.width * k * 2);
    const h = Math.round(c.info.height * k * 2);
    await sharp(c.data)
      .resize(w, h)
      .linear(GAIN.map((g) => 1 + (g - 1) * 0.25), [0, 0, 0]) // a quarter of the strip's warm-to-paper shift
      .modulate({ saturation: 0.94 })
      .webp({ quality: 86, alphaQuality: 100 })
      .toFile(`${OUT}/${name}-${poses[i]}.webp`);
    // scene units: background px * 700 / 1024
    meta[poses[i]] = { w: +((w / 2) * (700 / H)).toFixed(1), h: +((h / 2) * (700 / H)).toFixed(1) };
  }
  return meta;
}

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  for (const old of ['section-hashizume.webp']) require('fs').rmSync(`${OUT}/${old}`, { force: true });
  const sizes = {
    seita: await sheet('seita', ['press', 'bow', 'stand']),
    sokichi: await sheet('sokichi', ['hold', 'point', 'nod']),
    okon: await sheet('okon', ['hold', 'bow', 'wipe']),
    kisuke: await sheet('kisuke', ['teapot', 'pour', 'bow']),
    oharu: await sheet('oharu', ['search', 'ask', 'found']),
    kinji: await sheet('kinji', ['walk', 'rest', 'nod']),
  };
  console.log(JSON.stringify(sizes));
  // contact sheet of the sprites on paper colour
  const files = require('fs').readdirSync(OUT).filter((f) => !/^(section|street|far)/.test(f)).sort();
  const tiles = await Promise.all(files.map((f) => sharp(`${OUT}/${f}`).resize({ height: 220 }).png().toBuffer()));
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  let x = 10;
  const comps = tiles.map((t, i) => {
    const c = { input: t, left: x, top: 10 };
    x += metas[i].width + 10;
    return c;
  });
  await sharp({ create: { width: x, height: 320, channels: 3, background: '#e9ddbd' } }).composite(comps).png().toFile(`${S}/sprites-sheet.png`);
  for (const f of require('fs').readdirSync(OUT)) console.log(f, require('fs').statSync(`${OUT}/${f}`).size);
})();
