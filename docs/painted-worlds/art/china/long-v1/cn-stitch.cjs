// Joins L…L1 | base | R1…R: each step's new 1024 px plus a feathered 512 px overlap check.
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const fs = require('fs');
const [dir, outFile, previewW] = process.argv.slice(2);
const H = 1024, KEEP = 512, NEW = 1024, FE = 48;
(async () => {
  const L = ['L9','L8','L7','L6','L5','L4','L3','L2','L1'].filter((s) => fs.existsSync(`${dir}/${s}.png`));
  const R = ['R1','R2','R3','R4','R5','R6','R7','R8'].filter((s) => fs.existsSync(`${dir}/${s}.png`));
  // contiguous only
  const left = []; for (const s of ['L1','L2','L3','L4','L5','L6','L7','L8','L9']) { if (!L.includes(s)) break; left.push(s); }
  const right = []; for (const s of R) { if (right.length !== R.indexOf(s)) break; right.push(s); }
  const base = await sharp(`${dir}/base.png`).raw().toBuffer({ resolveWithObject: true });
  const BW = base.info.width;
  const W = BW + NEW * (left.length + right.length);
  const out = Buffer.alloc(W * H * 3);
  const put = async (file, srcX, w, dstX, featherSide) => {
    const { data, info } = await sharp(file).removeAlpha().resize(1536, H).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) {
      let t = 1;
      if (featherSide === 'left' && x < FE) t = x / FE; // blend into what is already laid on the left
      if (featherSide === 'right' && x > w - FE) t = (w - x) / FE;
      const o = (y * W + dstX + x) * 3, i = (y * info.width + srcX + x) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = t >= 1 ? data[i + c] : Math.round(out[o + c] * (1 - t) + data[i + c] * t);
    }
  };
  const x0 = NEW * left.length;
  // base
  const b3 = await sharp(`${dir}/base.png`).removeAlpha().raw().toBuffer();
  for (let y = 0; y < H; y++) b3.copy(out, (y * W + x0) * 3, y * BW * 3, (y + 1) * BW * 3);
  // right: each R frame = [kept 512 | new 1024]; lay the new part plus a feather back into the kept part
  let cx = x0 + BW;
  for (const s of right) { await put(`${dir}/${s}.png`, KEEP - FE, NEW + FE, cx - FE, 'left'); cx += NEW; }
  // left: each L frame = [new 1024 | kept 512]
  cx = x0;
  for (const s of left) { cx -= NEW; await put(`${dir}/${s}.png`, 0, NEW + FE, cx, 'right'); }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(outFile);
  if (previewW) await sharp(out, { raw: { width: W, height: H, channels: 3 } }).resize(+previewW).png().toFile(outFile.replace('.png', '-small.png'));
  console.log('joined', left.length, 'left +', right.length, 'right; width', W, 'px =', Math.round(W * 1200 / H), 'units');
})();
