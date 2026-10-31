// Builds the runtime street from Codex's Edo sections.
//  1. each piece (master 01–02, sections 03…) is placed by the manifest's world.x at
//     PX px per unit, from its sourceWindow, never stretched beyond its native pixels
//  2. where neighbours overlap, a least-difference vertical cut (DP) joins them,
//     feathered 4 px — no cross-fade (it ghosts)
//  3. the whole strip is mirrored, x' = 14000 − x, so the bridge is on the right
//     and the scroll reads right to left (Codex README: mirror the whole roll)
//  4. cut into 1000-unit sections street-0 … street-13 (missing ones are skipped),
//     plus gridded previews in world units for anchoring
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const fs = require('fs');
const S = process.argv[2];
const OUT = process.argv[3];
const PX = 1.4;
const H = Math.round(700 * PX);
const WORLD = 14000;
const FEATHER = 4;

async function rgb(buf) {
  return sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** cut[y]: column within [0, ow) of the overlap where older (left) gives way to newer (right). */
function seam(left, right, ow) {
  // left / right: raw RGB of the overlap region from each piece, ow × H
  const cost = new Float64Array(ow * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < ow; x++) {
      const i = (y * ow + x) * 3;
      let d = 0;
      for (let c = 0; c < 3; c++) d += (left[i + c] - right[i + c]) ** 2;
      const edge = Math.min(x, ow - 1 - x);
      cost[y * ow + x] = Math.sqrt(d) + (edge < 12 ? (12 - edge) * 30 : 0);
    }
  const acc = new Float64Array(ow * H), from = new Int32Array(ow * H);
  for (let x = 0; x < ow; x++) acc[x] = cost[x];
  for (let y = 1; y < H; y++)
    for (let x = 0; x < ow; x++) {
      let best = Infinity, bx = x;
      for (let dx = -1; dx <= 1; dx++) {
        const px = x + dx;
        if (px < 0 || px >= ow) continue;
        const v = acc[(y - 1) * ow + px];
        if (v < best) (best = v), (bx = px);
      }
      acc[y * ow + x] = best + cost[y * ow + x];
      from[y * ow + x] = bx;
    }
  let x = 0;
  for (let i = 1; i < ow; i++) if (acc[(H - 1) * ow + i] < acc[(H - 1) * ow + x]) x = i;
  const cut = new Int32Array(H);
  for (let y = H - 1; y >= 0; y--) (cut[y] = x), (x = from[y * ow + x]);
  return cut;
}

(async () => {
  const m = JSON.parse(fs.readFileSync(`${S}/cx/manifest.json`, 'utf8'));
  // pieces in drawing order (left to right before mirroring)
  const pieces = [{ name: 'master', file: `${S}/cx/key.png`, x: 0, w: 2100, win: null }];
  for (const a of m.assets) {
    const f = `${S}/cx/seg-${String(a.section).padStart(2, '0')}.png`;
    if (fs.existsSync(f)) pieces.push({ name: `s${a.section}`, file: f, x: a.world.x, w: a.world.width, win: a.sourceWindow, nativeH: a.native.height });
  }
  const W = Math.round(WORLD * PX);
  const out = Buffer.alloc(W * H * 3, 0);
  const filled = new Uint8Array(W); // columns that have content
  let prev = null;
  const report = [];
  const seams = []; // where each join actually falls, in mirrored px
  for (const p of pieces) {
    let img = sharp(p.file);
    if (p.win) img = img.extract({ left: Math.round(p.win.x), top: Math.round(p.win.y), width: Math.round(p.win.width), height: Math.round(Math.min(p.win.height, p.nativeH - Math.round(p.win.y))) });
    const pw = Math.round(p.w * PX);
    const { data, info } = await rgb(await img.resize(pw, H, { fit: 'fill' }).png().toBuffer());
    const x0 = Math.round(p.x * PX);
    // overlap with what is already laid
    let ox0 = x0, ox1 = x0;
    while (ox1 < Math.min(W, x0 + pw) && filled[ox1]) ox1++;
    const ow = ox1 - ox0;
    let cut = null;
    if (ow > 8) {
      const L = Buffer.alloc(ow * H * 3), R = Buffer.alloc(ow * H * 3);
      for (let y = 0; y < H; y++) {
        out.copy(L, y * ow * 3, (y * W + ox0) * 3, (y * W + ox1) * 3);
        data.copy(R, y * ow * 3, (y * pw) * 3, (y * pw + ow) * 3);
      }
      cut = seam(L, R, ow);
      const mean = cut.reduce((a, b) => a + b, 0) / cut.length;
      seams.push({ pair: `${prev}|${p.name}`, centerPx: W - Math.round(ox0 + mean) });
      report.push(`${prev}|${p.name}: overlap ${(ow / PX).toFixed(0)} units, cut ${(Math.min(...cut) / PX).toFixed(0)}–${(Math.max(...cut) / PX).toFixed(0)}`);
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < pw; x++) {
        const wx = x0 + x;
        if (wx < 0 || wx >= W) continue;
        let t = 1;
        if (cut && x < ow) t = Math.min(1, Math.max(0, (x - cut[y] + FEATHER / 2) / FEATHER));
        if (t === 0) continue;
        const o = (y * W + wx) * 3, i = (y * pw + x) * 3;
        for (let c = 0; c < 3; c++) out[o + c] = t === 1 ? data[i + c] : Math.round(out[o + c] * (1 - t) + data[i + c] * t);
      }
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + pw); x++) filled[x] = 1;
    prev = p.name;
  }
  console.log(report.join('\n'));
  // mirror the whole roll
  let mir = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).flop().raw().toBuffer();
  fs.writeFileSync(`${S}/cx/seams.json`, JSON.stringify(seams, null, 1));
  // seam repaints (cx-patch.mts): a narrow band, feathered, pasted over the joined roll
  const pdir = `${S}/cx/patches`;
  if (fs.existsSync(pdir)) {
    for (const f of fs.readdirSync(pdir).filter((f) => f.endsWith('.json'))) {
      const meta = JSON.parse(fs.readFileSync(`${pdir}/${f}`, 'utf8'));
      const { data: pd } = await sharp(`${pdir}/${meta.image}`).removeAlpha().resize(meta.w, meta.hFull, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      for (let y = meta.y0; y < H; y++) {
        // vertical feather above the band
        const ty = Math.min(1, (y - meta.y0) / meta.feather);
        for (let x = 0; x < meta.w; x++) {
          const dx = Math.abs(x - meta.w / 2);
          const tx = dx <= meta.band / 2 ? 1 : Math.max(0, 1 - (dx - meta.band / 2) / meta.feather);
          const t = tx * ty;
          if (t <= 0) continue;
          const o = (y * W + meta.x0 + x) * 3, i = (y * meta.w + x) * 3;
          for (let c = 0; c < 3; c++) mir[o + c] = Math.round(mir[o + c] * (1 - t) + pd[i + c] * t);
        }
      }
      report.push(`patched ${meta.pair} at px ${meta.x0}+${meta.w}`);
    }
    console.log(report.slice(-4).join('\n'));
  }
  await sharp(mir, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${S}/cx/runtime-full.png`);
  const mfilled = Uint8Array.from(filled).reverse();
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^street-\d+\.webp$/.test(f)) fs.rmSync(`${OUT}/${f}`);
  const SEC = Math.round(1000 * PX);
  const made = [];
  for (let k = 0; k < WORLD / 1000; k++) {
    const x = k * SEC;
    let have = 0;
    for (let i = x; i < x + SEC; i++) have += mfilled[i];
    if (have < SEC * 0.98) continue; // a section not painted yet
    await sharp(mir, { raw: { width: W, height: H, channels: 3 } }).extract({ left: x, top: 0, width: SEC, height: H }).webp({ quality: 82 }).toFile(`${OUT}/street-${k}.webp`);
    made.push(k);
    // gridded preview, 1 px per unit
    const sec = await sharp(mir, { raw: { width: W, height: H, channels: 3 } }).extract({ left: x, top: 0, width: SEC, height: H }).resize(1000, 700).png().toBuffer();
    let g = '';
    for (let u = 0; u <= 1000; u += 50) g += `<line x1="${u}" y1="0" x2="${u}" y2="700" stroke="${u % 100 ? '#f0f' : '#c00'}" stroke-width="${u % 100 ? 0.5 : 1}" opacity="0.55"/>`;
    for (let v = 0; v <= 700; v += 50) g += `<line x1="0" y1="${v}" x2="1000" y2="${v}" stroke="${v % 100 ? '#f0f' : '#c00'}" stroke-width="${v % 100 ? 0.5 : 1}" opacity="0.55"/>`;
    for (let u = 0; u < 1000; u += 100) for (let v = 100; v < 700; v += 100) g += `<text x="${u + 3}" y="${v - 3}" font-size="13" fill="#c00" font-family="sans-serif">${k * 1000 + u},${v}</text>`;
    await sharp(sec).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700">${g}</svg>`) }]).png().toFile(`${S}/cx/grid-${k}.png`);
  }
  await sharp(mir, { raw: { width: W, height: H, channels: 3 } }).resize(Math.round(W / 4), Math.round(H / 4)).png().toFile(`${S}/cx/runtime-small.png`);
  console.log('sections made:', made.join(','), `(${SEC}×${H} px each)`);
})();
