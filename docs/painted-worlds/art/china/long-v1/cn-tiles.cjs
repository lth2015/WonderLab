// full.png (20480×1024 = 24000×1200 units) → 20 tiles of 1024×1024 webp, plus a gridded preview per tile.
const sharp = require('/home/user/wonderlab/node_modules/sharp');
const fs = require('fs');
const [full, outDir, gridDir] = process.argv.slice(2);
(async () => {
  const { width, height } = await sharp(full).metadata();
  if (width !== 20480 || height !== 1024) throw new Error(`unexpected size ${width}×${height}`);
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(gridDir, { recursive: true });
  let total = 0;
  for (let k = 0; k < 20; k++) {
    const f = `${outDir}/scroll-${String(k).padStart(2, '0')}.webp`;
    await sharp(full).extract({ left: k * 1024, top: 0, width: 1024, height: 1024 }).webp({ quality: 80 }).toFile(f);
    total += fs.statSync(f).size;
    // grid in local units (x0 = k*1200 − 10800)
    const x0 = k * 1200 - 10800;
    let g = '';
    for (let u = 0; u <= 1200; u += 100) g += `<line x1="${u}" y1="0" x2="${u}" y2="1200" stroke="#c00" stroke-width="1" opacity=".5"/>`;
    for (let v = 0; v <= 1200; v += 100) g += `<line x1="0" y1="${v}" x2="1200" y2="${v}" stroke="#c00" stroke-width="1" opacity=".5"/>`;
    for (let u = 0; u < 1200; u += 200) for (let v = 200; v < 1200; v += 200) g += `<text x="${u + 3}" y="${v - 4}" font-size="20" fill="#c00" font-family="sans-serif">${x0 + u},${v}</text>`;
    const tile = await sharp(full).extract({ left: k * 1024, top: 0, width: 1024, height: 1024 }).resize(1200, 1200).png().toBuffer();
    const gridded = await sharp(tile).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">${g}</svg>`) }]).png().toBuffer();
    await sharp(gridded).resize(800).png().toFile(`${gridDir}/grid-${String(k).padStart(2, '0')}.png`);
  }
  console.log('tiles', 20, 'total', Math.round(total / 1024), 'KB');
})();
