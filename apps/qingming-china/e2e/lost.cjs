// 中国篇 C5「汴河拾遗」：从新存档走一遍小柳的竹管小笔。道谢在先、下一次才说起、附近与地图出现线索、
// 在画中水埠拾起、行囊里有、还给小柳得一句谢话且不加文钱。也看画中五件东西都在、旧档不坏。
//   node apps/qingming-china/e2e/lost.cjs <url> [shot-dir]
const { chromium } = require('playwright');
const [URL, SHOTS] = process.argv.slice(2);
if (!URL) throw new Error('usage: node lost.cjs <url> [shot-dir]');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad.push(m); };
  const game = () => p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('ww:qingming-china:save') && !x.endsWith(':session')); return JSON.parse(localStorage.getItem(k)); });
  const sheet = p.locator('dialog.sheet');
  const closeSheet = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250); if (await sheet.count()) { const x = sheet.getByRole('button', { name: /关闭|收起|返回街上/ }); if (await x.count()) await x.first().click(); } await p.waitForTimeout(250); };
  const talkLiu = async () => { await p.getByRole('button', { name: /与小柳交谈/ }).click(); await p.waitForTimeout(400); };
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '入画', exact: true }).click(); await p.waitForTimeout(800);
  // 一纸春风
  await talkLiu();
  await sheet.getByRole('button', { name: '替他压住画纸' }).click(); await p.waitForTimeout(300);
  await sheet.getByRole('button', { name: /留下这一页|落笔|收进画册|就画这个/ }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  if (!(await game()).claimed.includes('paper')) {
    const btns = await sheet.locator('.dialogue-actions button').allInnerTexts();
    throw new Error('could not finish paper: ' + btns.join(' / '));
  }
  await closeSheet();
  // thanks first
  await talkLiu();
  ok(!(await p.locator('.lost-word').count()), 'the first visit after the story: the thanks, no word of a loss');
  await closeSheet();
  await talkLiu();
  const word = await p.locator('.lost-word').innerText().catch(() => '');
  ok(/竹管小笔/.test(word), `the next visit: he speaks of it (${word.slice(0, 18)}…)`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/china-lost-word.png` });
  await closeSheet();
  await talkLiu();
  ok(!(await p.locator('.lost-word').count()), 'once only');
  await closeSheet();
  // 附近 and the map
  await p.getByRole('button', { name: /附近/ }).first().click(); await p.waitForTimeout(300);
  const near = sheet.locator('.nearby-list button').filter({ hasText: '竹管小笔' });
  ok((await near.count()) === 1, '附近 lists the lost brush');
  await sheet.getByRole('button', { name: '展开长卷地图' }).click(); await p.waitForTimeout(400);
  ok((await p.locator('.town-map-mark.lost').count()) === 1, 'the map shows one ？');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/china-lost-map.png` });
  await p.locator('.town-map-list summary').click();
  await p.locator('.town-map-list li button').filter({ hasText: '竹管小笔' }).click(); await p.waitForTimeout(1200);
  // pick it up in the painting
  const thing = p.getByRole('button', { name: /拾起小柳的竹管小笔/ });
  ok((await thing.count()) === 1, 'the brush lies in view at the water steps');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/china-lost-street.png` });
  await thing.click(); await p.waitForTimeout(400);
  ok((await game()).progress.lost.found.includes('brush'), 'picked up');
  // 行囊
  await p.getByRole('button', { name: /行囊/ }).first().click(); await p.waitForTimeout(300);
  ok((await sheet.innerText()).includes('拾来的竹管小笔'), '行囊 carries it');
  await closeSheet();
  // give it back
  const money = (await game()).wallet;
  await p.getByRole('button', { name: /附近/ }).first().click(); await p.waitForTimeout(200);
  await closeSheet();
  await p.evaluate(() => document.querySelector('.scroll-surface').focus());
  for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(80); }
  await talkLiu();
  await sheet.getByRole('button', { name: '把竹管小笔还给小柳' }).click(); await p.waitForTimeout(400);
  const g = await game();
  ok(g.progress.lost.returned.includes('brush') && g.wallet === money, `given back, no money (${money} → ${g.wallet})`);
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'} | 4xx ${bad.filter((x) => /^\d/.test(x)).length}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
