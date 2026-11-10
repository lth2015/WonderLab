// 江戸編：通りすがりの人と話す。新しい存档で、(1) 一覧から魚売りを呼び止め、名前・立ち絵・仕事の話を
// 二つ聞いて別れる、(2) 通りを歩く人足を直接タップして、その人が立ち止まり（歩く動きが止まる）、
// 話し終えるとまた歩き出すこと、もう一度呼び止めると覚えていること、人物帳に残ることを見る。
//   node apps/qingming-edo/e2e/passers.cjs <url> [shot-dir]
const { chromium } = require('playwright');
const [URL, SHOTS] = process.argv.slice(2);
if (!URL) throw new Error('usage: node passers.cjs <url> [shot-dir]');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad.push(m); };
  const d = p.locator('.dialogue');
  const f = p.locator('details.fold:not(.more)');
  await p.goto(URL);
  await p.getByRole('button', { name: '絵巻に入る' }).click(); await p.waitForTimeout(700);
  // (1) from the list
  await p.getByRole('button', { name: '近くのこと' }).click(); await p.waitForTimeout(200);
  if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
  const callers = await f.locator('li button').filter({ hasText: '呼び止めて話す' }).allInnerTexts();
  ok(callers.length >= 4, `passers in the list: ${callers.join(' / ')}`);
  await f.locator('li button').filter({ hasText: /^魚売り/ }).click(); await p.waitForTimeout(400);
  for (let i = 0; i < 4 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); }
  ok(/魚売り/.test(await d.locator('.speaker').innerText()) && (await d.locator('img.face').count()) === 1, 'the fishmonger speaks, with his portrait');
  const qs = await d.locator('.choices button').allInnerTexts();
  ok(qs.length === 4 && qs.some((q) => /仕入れ/.test(q)), `questions about his work: ${qs.join(' / ')}`);
  await d.locator('.choices button').filter({ hasText: '仕入れ' }).click(); await p.waitForTimeout(200);
  const ans = await d.locator('.said').innerText();
  ok(/魚河岸/.test(ans), `answer: ${ans.slice(0, 24)}…`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/passer-talk.png` });
  for (let i = 0; i < 4 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); }
  await d.locator('.choices button').filter({ hasText: 'おすすめ' }).click(); await p.waitForTimeout(200);
  for (let i = 0; i < 4 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); }
  await d.locator('.choices button').filter({ hasText: '引き止めて' }).click(); await p.waitForTimeout(200);
  ok(/じゃあな/.test(await d.locator('.said').innerText()), 'his parting word');
  await d.getByRole('button', { name: /^閉じる$/ }).click(); await p.waitForTimeout(300);
  // (2) a direct tap on a walking passer-by: they stop while talking, then walk on
  const walker = p.locator('[data-walker="crowd2-samurai"]');
  await p.getByRole('button', { name: '町の絵図を開く' }).click(); await p.waitForTimeout(300);
  const row = await p.locator('.map-row').nth(3).boundingBox();
  await p.mouse.click(row.x + row.width * (880 / 4000), row.y + row.height / 2); await p.waitForTimeout(1200);
  const state = () => walker.evaluate((g) => g.getAnimations().map((a) => a.playState).join(','));
  const box = await walker.boundingBox();
  ok(!!box, 'the samurai is walking in view');
  await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45); await p.waitForTimeout(500);
  ok((await d.count()) === 1 && /武士/.test(await d.innerText()), 'tapping him opens the talk');
  ok(/paused/.test(await state()), `he stands still while talking (${await state()})`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/passer-stop.png` });
  for (let i = 0; i < 4 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); }
  await d.locator('.choices button').filter({ hasText: '引き止めて' }).click(); await p.waitForTimeout(200);
  await d.getByRole('button', { name: /^閉じる$/ }).click(); await p.waitForTimeout(3600);
  ok(/running/.test(await state()), `he walks on afterwards (${await state()})`);
  // (3) met again, they remember; the 人物帳 keeps who was talked with
  await p.getByRole('button', { name: '近くのこと' }).click(); await p.waitForTimeout(200);
  if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
  await f.locator('li button').filter({ hasText: /^魚売り/ }).click(); await p.waitForTimeout(400);
  await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(150);
  ok(/また会ったな/.test(await d.locator('.said').innerText()), 'met again, he remembers the player');
  for (let i = 0; i < 4 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); }
  await d.locator('.choices button').filter({ hasText: '引き止めて' }).click(); await p.waitForTimeout(200);
  await d.getByRole('button', { name: /^閉じる$/ }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /^絵巻帳/ }).click();
  await p.getByRole('button', { name: '町の人' }).click(); await p.waitForTimeout(300);
  const met = await p.locator('.passers-met li b').allInnerTexts();
  ok(met.includes('魚売り') && met.includes('通りがかりの武士'), `the 人物帳 keeps who was talked with: ${met.join('、')}`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/passers-met.png`, fullPage: false });
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
