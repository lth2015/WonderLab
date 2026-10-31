// Stitches outpainted sections right-to-left: <dir> <prefix> A B C [D...]
// (A is the rightmost, generated first; each next one was outpainted to its left.)
// 1. Each section's paper is matched to A's: per-channel gain from the mean of the
//    sky rows (the top band is plain paper by the prompt).
// 2. Joins run along the least-difference vertical cut inside the 512 px overlap
//    (a cross-fade leaves ghosts, since outpainting redraws the kept strip).
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const args = process.argv.slice(2);
const ALIGN = args.includes('--align-band');
const [dir, prefix, ...names] = args.filter((a) => !a.startsWith('--'));
const W = 1536, H = 1024, KEEP = 512, FEATHER = 6, SKY = [8, 140];

async function load(n) {
  const buf = await sharp(`${dir}/${prefix}-${n}.png`).removeAlpha().raw().toBuffer();
  const mean = [0, 0, 0];
  let count = 0;
  for (let y = SKY[0]; y < SKY[1]; y++)
    for (let x = 0; x < W; x += 3) {
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) mean[c] += buf[i + c];
      count++;
    }
  return { n, buf, sky: mean.map((v) => v / count) };
}

function seam(newer, older) {
  const cost = new Float64Array(KEEP * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < KEEP; x++) {
      const a = (y * W + W - KEEP + x) * 3, b = (y * W + x) * 3;
      let d = 0;
      for (let c = 0; c < 3; c++) d += (newer[a + c] - older[b + c]) ** 2;
      const edge = Math.min(x, KEEP - 1 - x);
      cost[y * KEEP + x] = Math.sqrt(d) + (edge < 48 ? (48 - edge) * 20 : 0);
    }
  const acc = new Float64Array(KEEP * H), from = new Int16Array(KEEP * H);
  for (let x = 0; x < KEEP; x++) acc[x] = cost[x];
  for (let y = 1; y < H; y++)
    for (let x = 0; x < KEEP; x++) {
      let best = Infinity, bx = x;
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        if (px < 0 || px >= KEEP) continue;
        const v = acc[(y - 1) * KEEP + px];
        if (v < best) (best = v), (bx = px);
      }
      acc[y * KEEP + x] = best + cost[y * KEEP + x];
      from[y * KEEP + x] = bx;
    }
  let x = 0;
  for (let i = 1; i < KEEP; i++) if (acc[(H - 1) * KEEP + i] < acc[(H - 1) * KEEP + x]) x = i;
  const cut = new Int16Array(H);
  for (let y = H - 1; y >= 0; y--) (cut[y] = x), (x = from[y * KEEP + x]);
  return cut;
}

(async () => {
  const secs = await Promise.all(names.map(load));
  if (ALIGN) {
    // far layer: line every section's distant band up with the first one's
    // (outpainting sometimes draws the horizon higher or lower)
    const bandRow = (buf) => {
      const lum = [];
      for (let y = 0; y < H; y++) {
        let t = 0;
        for (let x = 0; x < W; x += 4) { const i = (y * W + x) * 3; t += buf[i] + buf[i + 1] + buf[i + 2]; }
        lum.push(t);
      }
      let best = 300, bv = Infinity;
      for (let y = 300; y < 760; y++) { const v = lum[y - 3] + lum[y] + lum[y + 3]; if (v < bv) (bv = v), (best = y); }
      return best;
    };
    const ref0 = bandRow(secs[0].buf);
    for (const s of secs) {
      const d = ref0 - bandRow(s.buf);
      if (!d) continue;
      const out = Buffer.alloc(s.buf.length);
      for (let y = 0; y < H; y++) {
        const sy = Math.min(H - 1, Math.max(0, y - d));
        s.buf.copy(out, y * W * 3, sy * W * 3, (sy + 1) * W * 3);
      }
      s.buf = out;
      console.log(s.n, 'band shifted', d, 'px');
    }
  }
  const ref = secs[0].sky;
  for (const s of secs) {
    const g = ref.map((v, c) => v / s.sky[c]);
    for (let i = 0; i < s.buf.length; i += 3) for (let c = 0; c < 3; c++) s.buf[i + c] = Math.min(255, Math.round(s.buf[i + c] * g[c]));
    console.log(s.n, 'sky', s.sky.map((v) => v.toFixed(0)).join(','), 'gain', g.map((v) => v.toFixed(3)).join(','));
  }
  const n = secs.length, step = W - KEEP, total = W + (n - 1) * step;
  const out = Buffer.alloc(total * H * 3);
  // leftmost (last generated) first, then each older one laid over along its seam
  const left = secs[n - 1];
  for (let y = 0; y < H; y++) left.buf.copy(out, y * total * 3, y * W * 3, (y + 1) * W * 3);
  const cuts = [];
  for (let k = n - 2; k >= 0; k--) {
    const older = secs[k], newer = secs[k + 1];
    const x0 = (n - 1 - k) * step;
    const cut = seam(newer.buf, older.buf);
    cuts.push(`${newer.n}|${older.n} x ${Math.min(...cut)}..${Math.max(...cut)}`);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = Math.min(1, Math.max(0, (x - cut[y] + FEATHER / 2) / FEATHER));
        if (t === 0) continue;
        const o = (y * total + x0 + x) * 3, i = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(out[o + c] * (1 - t) + older.buf[i + c] * t);
      }
  }
  const img = () => sharp(out, { raw: { width: total, height: H, channels: 3 } });
  await img().png().toFile(`${dir}/${prefix}-full.png`);
  await img().resize(Math.round(total / 2), 512).png().toFile(`${dir}/${prefix}-full-small.png`);
  for (let k = 1; k < n; k++) {
    const x = k * step + 256;
    await img().extract({ left: x - 400, top: 0, width: 800, height: H }).png().toFile(`${dir}/${prefix}-seam-${k}.png`);
  }
  console.log('full', total, 'x', H, cuts.join('; '));
})();
