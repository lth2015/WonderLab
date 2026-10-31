// Turns the plain-paper sky of the stitched mid strip transparent, so the far
// layer shows behind the roofs. Flood fill from the top edge through pixels
// close to the sky's paper colour, never below MAX_Y (the street is paper-coloured
// too); the mask edge is softened by a small blur.
// Then crops the 3000-unit scene (rightmost 4389 px) into three 1000-unit
// sections and writes a gridded preview in world units for placing things.
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const S = '/tmp/claude-0/-home-user-wonderlab/ec2033cc-b1cd-5687-b5c6-3d575ad20284/scratchpad/r3';
const N = 9; // sections of 1000 units
const OUT = '/home/user/wonderlab/apps/qingming-edo/src/assets/art';
const H = 1024, PX = 1024 / 700, SEC = Math.round(1000 * PX); // 1463
const TOL = 22, MAX_Y = 640;

(async () => {
  const { data, info } = await sharp(`${S}/mid-full.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  // sky colour: mean of the top rows
  const ref = [0, 0, 0];
  let n = 0;
  for (let y = 4; y < 60; y++) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) ref[c] += data[i + c]; n++; }
  ref.forEach((v, c) => (ref[c] = v / n));
  const near = (i) => Math.hypot(data[i] - ref[0], data[i + 1] - ref[1], data[i + 2] - ref[2]) < TOL;
  const sky = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) if (near(x * 3)) (sky[x] = 1), stack.push(x);
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= MAX_Y) continue;
      const q = ny * W + nx;
      if (sky[q] || !near(q * 3)) continue;
      sky[q] = 1;
      stack.push(q);
    }
  }
  const alpha = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = sky[i] ? 0 : 255;
  const { data: soft, info: si } = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  if (si.channels !== 1 || soft.length !== W * H) throw new Error('mask is ' + si.channels + ' channels');
  const px = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = data[i * 3];
    px[i * 4 + 1] = data[i * 3 + 1];
    px[i * 4 + 2] = data[i * 3 + 2];
    px[i * 4 + 3] = soft[i];
  }
  const rgba = await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).resize(1152, 256).png().toFile(`${S}/mask-small.png`);
  await sharp(rgba).toFile(`${S}/mid-keyed.png`);

  // the scene: the rightmost 3 × 1463 px
  const x0 = W - N * SEC;
  for (let k = 0; k < N; k++) {
    await sharp(rgba)
      .extract({ left: x0 + k * SEC, top: 0, width: SEC, height: H })
      .webp({ quality: 80, alphaQuality: 90 })
      .toFile(`${OUT}/street-${k}.webp`);
  }
  // far layer: whole strip, height 700 units → 1024 px kept
  await sharp(`${S}/far-full.png`).webp({ quality: 72 }).toFile(`${OUT}/far.webp`);

  // gridded previews, 1 px per world unit, over a mid-grey so the transparent sky shows
  for (let k = 0; k < N; k++) {
    const sec = await sharp(rgba).extract({ left: x0 + k * SEC, top: 0, width: SEC, height: H }).resize(1000, 700).png().toBuffer();
    let grid = '';
    for (let u = 0; u <= 1000; u += 50) grid += `<line x1="${u}" y1="0" x2="${u}" y2="700" stroke="${u % 100 ? '#f0f' : '#c00'}" stroke-width="${u % 100 ? 0.5 : 1}" opacity="0.6"/>`;
    for (let v = 0; v <= 700; v += 50) grid += `<line x1="0" y1="${v}" x2="1000" y2="${v}" stroke="${v % 100 ? '#f0f' : '#c00'}" stroke-width="${v % 100 ? 0.5 : 1}" opacity="0.6"/>`;
    for (let u = 0; u < 1000; u += 100) for (let v = 100; v < 700; v += 100) grid += `<text x="${u + 3}" y="${v - 3}" font-size="13" fill="#c00" font-family="sans-serif">${k * 1000 + u},${v}</text>`;
    await sharp({ create: { width: 1000, height: 700, channels: 3, background: '#8aa' } })
      .composite([{ input: sec }, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700">${grid}</svg>`) }])
      .png()
      .toFile(`${S}/grid-${k}.png`);
  }
  console.log('ref sky', ref.map((v) => v.toFixed(0)).join(','), 'scene starts at px', x0);
})();
