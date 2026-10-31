// Stitches street-C | street-B | street-A into one long strip.
// The outpainting pass redraws the kept strip slightly differently, so a
// cross-fade makes ghosts. Instead, inside each 512 px overlap a vertical cut
// is found along the path of least difference between the two versions
// (image quilting, dynamic programming); left of it comes from the new
// section, right of it from the old one, with a 6 px feather on the cut.
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const dir = process.argv[2];
const W = 1536, H = 1024, KEEP = 512, FEATHER = 6;

const raw = (f) => sharp(f).removeAlpha().raw().toBuffer();

/** cut[y] = x within the overlap (0..KEEP-1) where the minimum-difference seam crosses row y. */
function seam(left, right, lx0, rx0) {
  // left: the newer section (its overlap starts at lx0); right: the older (overlap starts at rx0)
  const cost = new Float64Array(KEEP * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < KEEP; x++) {
      const a = (y * W + lx0 + x) * 3, b = (y * W + rx0 + x) * 3;
      let d = 0;
      for (let c = 0; c < 3; c++) d += (left[a + c] - right[b + c]) ** 2;
      // keep the cut away from the overlap's edges, where the newer pass is least faithful
      const edge = Math.min(x, KEEP - 1 - x);
      cost[y * KEEP + x] = Math.sqrt(d) + (edge < 48 ? (48 - edge) * 20 : 0);
    }
  const acc = new Float64Array(KEEP * H);
  const from = new Int16Array(KEEP * H);
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
  for (let y = H - 1; y >= 0; y--) {
    cut[y] = x;
    x = from[y * KEEP + x];
  }
  return cut;
}

(async () => {
  const [A, B, C] = await Promise.all(['A', 'B2', 'C'].map((s) => raw(`${dir}/street-${s}.png`)));
  const total = W + 2 * (W - KEEP); // 3584
  const out = Buffer.alloc(total * H * 3);
  const put = (buf, x0, from, to) => {
    for (let y = 0; y < H; y++) buf.copy(out, (y * total + x0 + from) * 3, (y * W + from) * 3, (y * W + to) * 3);
  };
  // C fully, then B and A each laid over the previous along a seam
  put(C, 0, 0, W);
  const layer = (older, newer, x0) => {
    // older's overlap = older x 0..KEEP; newer's overlap = newer x W-KEEP..W (both at out x0..x0+KEEP)
    const cut = seam(newer, older, W - KEEP, 0);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = Math.min(1, Math.max(0, (x - cut[y] + FEATHER / 2) / FEATHER)); // 0 = newer, 1 = older
        if (t === 0) continue;
        const o = (y * total + x0 + x) * 3, i = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(out[o + c] * (1 - t) + older[i + c] * t);
      }
    return cut;
  };
  const cutCB = layer(B, C, W - KEEP);
  const cutBA = layer(A, B, 2 * (W - KEEP));
  const info = (c) => `x ${Math.min(...c)}..${Math.max(...c)}`;
  const img = () => sharp(out, { raw: { width: total, height: H, channels: 3 } });
  await img().png().toFile(`${dir}/street-full.png`);
  await img().resize(1792, 512).png().toFile(`${dir}/street-full-small.png`);
  for (const [n, x] of [['1', W - KEEP + 256], ['2', 2 * (W - KEEP) + 256]])
    await img().extract({ left: x - 400, top: 0, width: 800, height: H }).png().toFile(`${dir}/seam-${n}.png`);
  console.log('full', total, 'x', H, 'cut C|B', info(cutCB), 'cut B|A', info(cutBA));
})();
