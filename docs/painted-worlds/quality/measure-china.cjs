// Spec §19 measurements, headless Chromium as a stand-in for the reference phones:
//   - first load, no cache, 10 Mbps down / 100 ms RTT, CPU 4× slower: time until
//     the street is painted and 「絵巻に入る」 can be pressed; bytes transferred
//   - dragging the street for 20 s with CPU 4× slower: frame times (median, p95)
// usage: node measure.cjs <url> [runs]
const { chromium } = require('playwright');
const [URL, RUNS = '3'] = process.argv.slice(2);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

(async () => {
  const b = await chromium.launch();
  const loads = [];
  for (let r = 0; r < +RUNS; r++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: (10 * 1e6) / 8, uploadThroughput: (5 * 1e6) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0;
    cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
    const t0 = Date.now();
    await p.goto(URL, { waitUntil: 'commit' });
    await p.locator('.enter-button').waitFor({ state: 'visible' });
    // the street images in view have decoded
    await p.waitForFunction(() => {
      const imgs = [...document.querySelectorAll('.roll-tiles image')];
      return imgs.length > 0;
    });
    await p.evaluate(() => Promise.all([...document.querySelectorAll('.roll-tiles image')].map((i) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => res(null);
      im.src = i.getAttribute('href');
    }))));
    const tti = Date.now() - t0;
    await p.waitForTimeout(1500); // let lazy requests settle for the byte count
    loads.push({ tti, kb: Math.round(bytes / 1024) });
    await ctx.close();
  }
  console.log('first load runs:', loads.map((l) => `${l.tti} ms / ${l.kb} KB`).join(', '));
  console.log('first load median:', med(loads.map((l) => l.tti)), 'ms;', med(loads.map((l) => l.kb)), 'KB');

  // frame times while dragging
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.goto(URL);
  await p.locator('.enter-button').click();
  await p.waitForTimeout(800);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const tick = (t) => {
      window.__ft.push(t - last);
      last = t;
      if (!window.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const box = await p.locator('.scroll-surface').boundingBox();
  const y = box.y + box.height * 0.6;
  const end = Date.now() + 20000;
  let dir = 1;
  while (Date.now() < end) {
    await p.mouse.move(box.x + 300, y);
    await p.mouse.down();
    for (let i = 1; i <= 20; i++) await p.mouse.move(box.x + 300 - dir * i * 12, y);
    await p.mouse.up();
    if (Math.random() < 0.15) dir = -dir;
  }
  const ft = await p.evaluate(() => ((window.__stop = true), window.__ft.slice(5)));
  const cam = await p.locator('.scene-caption p').textContent();
  console.log(`frames: ${ft.length} over 20 s, median ${med(ft).toFixed(1)} ms, p95 ${pct(ft, 0.95).toFixed(1)} ms, max ${Math.max(...ft).toFixed(1)} ms; camera ended at ${cam}`);
  await b.close();
})();
