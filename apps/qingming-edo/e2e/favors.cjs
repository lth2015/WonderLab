// 江戸編：路人のちょっとした頼み。通して遊んだ存档から、一覧で武士を呼び止めて国元へのお土産のことを
// 聞くと、名所絵のよい刷りを探していると頼まれること、青葉屋を教えると礼を言われること、もう一度聞いても
// 頼まれないこと、人物帳の「会いに行く」で清太のところへ行って話すと、お侍さまが来たと一度だけ言うことを見る。
//   node apps/qingming-edo/e2e/favors.cjs <url> <save.json> [shot-dir]
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE, SHOTS] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node favors.cjs <url> <save.json> [shot-dir]');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad.push(m); };
  const d = p.locator('.dialogue');
  const f = p.locator('details.fold:not(.more)');
  const toChoices = async () => { for (let i = 0; i < 6 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); } };
  const said = async () => (await d.locator('.said').allInnerTexts()).join(' ');
  const call = async (re) => {
    await p.getByRole('button', { name: '近くのこと' }).click(); await p.waitForTimeout(200);
    if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
    await f.locator('li button').filter({ hasText: re }).first().click(); await p.waitForTimeout(400);
  };
  const ask = async (topic) => { await toChoices(); await d.locator('.choices button').filter({ hasText: topic }).click(); await p.waitForTimeout(200); };
  await p.goto(URL);
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), fs.readFileSync(SAVE, 'utf8'));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click(); await p.waitForTimeout(700);
  await call(/^通りがかりの武士/);
  await ask('お土産');
  await toChoices();
  ok(/名所絵/.test(await said()), `after the answer, he asks: ${(await said()).slice(0, 30)}…`);
  const offers = await d.locator('.choices button').allInnerTexts();
  ok(offers.length === 2 && /青葉屋/.test(offers[0]), `what to say: ${offers.join(' / ')}`);
  await d.locator('.choices button').first().click(); await p.waitForTimeout(200);
  ok(/紙屋か/.test(await said()), `his thanks: ${(await said()).slice(0, 24)}…`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/favor-thanks.png` });
  await ask('お土産');
  await toChoices();
  ok(!/名所絵/.test(await said()) && (await d.locator('.choices button').count()) === 5, 'asked again, he does not ask twice');
  await d.locator('.choices button').filter({ hasText: '引き止めて' }).click(); await p.waitForTimeout(200);
  await d.getByRole('button', { name: /^閉じる$/ }).click(); await p.waitForTimeout(300);
  // 清太 mentions it, once
  await p.getByRole('button', { name: /^絵巻帳/ }).click();
  await p.getByRole('button', { name: '町の人' }).click(); await p.waitForTimeout(300);
  await p.locator('.person').filter({ hasText: '青葉屋' }).first().getByRole('button', { name: '会いに行く' }).click(); await p.waitForTimeout(900);
  let heard = '', times = 0;
  for (let k = 0; k < 6; k++) {
    await call(/^清太/);
    const lines = [];
    for (let i = 0; i < 8; i++) {
      lines.push(await said());
      if (await d.locator('.choices').count()) break;
      const btn = d.getByRole('button', { name: /^(次へ|閉じる)$/ });
      if (/閉じる/.test(await btn.innerText())) break;
      await btn.click(); await p.waitForTimeout(120);
    }
    if (lines.some((l) => /黒羽織/.test(l))) { times++; heard = lines.find((l) => /黒羽織/.test(l)); if (SHOTS && times === 1) await p.screenshot({ path: `${SHOTS}/favor-told.png` }); }
    if (await d.locator('.choices').count()) await d.getByRole('button', { name: '町に戻る' }).click();
    else await d.getByRole('button', { name: /^閉じる$/ }).click();
    await p.waitForTimeout(250);
  }
  ok(times === 1, `清太 says it once: ${heard.slice(0, 30)}…`);
  await p.getByRole('button', { name: /^絵巻帳/ }).click();
  await p.getByRole('button', { name: '町の人' }).click(); await p.waitForTimeout(300);
  const done = await p.locator('.passers-met .favor-done').allInnerTexts();
  ok(done.length === 1 && /清太/.test(done[0]), `the 人物帳 keeps it: ${done.join(' / ')}`);
  if (SHOTS) await p.locator('.passers-met').screenshot({ path: `${SHOTS}/favor-book.png` });
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
