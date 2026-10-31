// Cuts the three Seita poses out of the sheet and places each on the background
// at the paper-shop front, at the scale of the background's passers-by.
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const S = '/tmp/claude-0/-home-user-wonderlab/ec2033cc-b1cd-5687-b5c6-3d575ad20284/scratchpad';

(async () => {
  const sheet = sharp(`${S}/edo-seita-01.png`);
  const { width: W, height: H } = await sheet.metadata();
  const poses = [];
  for (let i = 0; i < 3; i++) {
    const third = await sharp(`${S}/edo-seita-01.png`)
      .extract({ left: Math.round((i * W) / 3), top: 0, width: Math.round(W / 3), height: H })
      .png()
      .toBuffer();
    // trim to the figure by its alpha
    const trimmed = await sharp(third).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer({ resolveWithObject: true });
    poses.push(trimmed);
  }
  // Standing passers-by in the background are ~210 px tall; the standing pose sets the scale.
  const k = 210 / poses[2].info.height;
  const placed = [];
  for (const p of poses) {
    const w = Math.round(p.info.width * k);
    const h = Math.round(p.info.height * k);
    // a warm, slightly muted tint to sit in the background's aged-paper wash
    const fig = await sharp(p.data)
      .resize(w, h)
      .modulate({ saturation: 0.82, brightness: 0.97 })
      .tint({ r: 238, g: 222, b: 196 })
      .png()
      .toBuffer();
    placed.push({ fig, w, h });
  }
  // feet on the ground in front of the paper-shop floor (background coordinates)
  const spots = [
    { cx: 830, foot: 692 }, // kneeling on the raised shop floor, pressing the paper
    { cx: 830, foot: 692 }, // bowing on the shop floor
    { cx: 1080, foot: 800 }, // standing near the bridge foot
  ];
  const panels = [];
  for (let i = 0; i < 3; i++) {
    const { fig, w, h } = placed[i];
    const sh = Math.max(10, Math.round(h * 0.1));
    const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${sh}"><ellipse cx="${w / 2}" cy="${sh / 2}" rx="${w * 0.42}" ry="${sh * 0.32}" fill="rgb(60,45,30)" fill-opacity="0.22"/></svg>`))
      .blur(2.5)
      .png()
      .toBuffer();
    const out = await sharp(`${S}/edo-bg-01.png`)
      .composite([
        { input: shadow, left: spots[i].cx - Math.round(w / 2), top: spots[i].foot - Math.round(h * 0.05) },
        { input: fig, left: spots[i].cx - Math.round(w / 2), top: spots[i].foot - h },
      ])
      .png()
      .toBuffer();
    const file = `${S}/edo-composite-${i + 1}.png`;
    await sharp(out).toFile(file);
    // close crop around the shop front for a side-by-side check
    panels.push(await sharp(out).extract({ left: 560, top: 400, width: 680, height: 460 }).png().toBuffer());
  }
  await sharp({ create: { width: 680 * 3 + 20, height: 460, channels: 3, background: '#777' } })
    .composite(panels.map((b, i) => ({ input: b, left: i * 690, top: 0 })))
    .png()
    .toFile(`${S}/edo-composite-states.png`);
  console.log('scale', k.toFixed(3), 'sizes', placed.map((p) => `${p.w}x${p.h}`).join(' '));
})();
