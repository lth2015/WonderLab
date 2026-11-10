// 江戸編：買い物。全話を終えた存档から、喜助の茶店で一服（6文、助けた人の暮らしの一場面）を
// 何度かし、青葉屋の清太から記念の題箋を一枚買って、絵巻帳の頁に貼りかえる。文が正しく減り、
// 題箋が頁に残る（再読み込みしても）ことを見る。
//   node apps/qingming-edo/e2e/shop.cjs <url> <save.json> [shot-dir]
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE, SHOTS] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node shop.cjs <url> <save.json> [shot-dir]');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const d = p.locator('.dialogue');
  const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('ww:qingming-edo:save')));
  const shot = (n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });
  await p.goto(URL);
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), fs.readFileSync(SAVE, 'utf8'));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click();
  await p.waitForTimeout(400);
  const f = p.locator('details.fold:not(.more)');
  /** Talk to someone until their everyday word offers the choice `re`. */
  const reach = async (who, re) => {
    for (let k = 0; k < 10; k++) {
      if (!(await d.count())) {
        await p.getByRole('button', { name: '近くのこと' }).click();
        await p.waitForTimeout(150);
        if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
        await f.locator('li button').filter({ hasText: who }).first().click();
        await p.waitForTimeout(350);
      }
      const c = d.getByRole('button', { name: re });
      if (await c.count()) return c.first().click();
      const n = d.getByRole('button', { name: /^(次へ|閉じる|町に戻る)$/ });
      if (await n.count()) await n.first().click();
      await p.waitForTimeout(120);
    }
    throw new Error(`never offered ${re}`);
  };
  const bad = [];
  const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) bad.push(msg); };

  const m0 = (await save()).wallet.balanceMinor;
  const moments = [];
  for (let i = 0; i < 3; i++) {
    await reach(/^喜助/, /一服する/);
    await p.waitForTimeout(200);
    if (i === 0) await shot('tea-offer');
    await p.locator('.shop').getByRole('button', { name: /一服する/ }).click();
    await p.waitForTimeout(200);
    const said = [];
    for (let k = 0; k < 8; k++) {
      said.push(await p.locator('.shop .line-body p').last().innerText());
      const last = p.locator('.shop').getByRole('button', { name: 'ごちそうさま' });
      if (await last.count()) {
        if (i === 0) await shot('tea-moment');
        await last.click();
        break;
      }
      await p.locator('.shop').getByRole('button', { name: '次へ' }).click();
      await p.waitForTimeout(120);
    }
    moments.push(said.slice(2).join(' ').slice(0, 30));
  }
  const m1 = (await save()).wallet.balanceMinor;
  ok(m1 === m0 - 18, `three rests cost 18文 (${m0} → ${m1})`);
  ok(new Set(moments).size === 3, `three different moments: ${moments.join(' / ')}`);

  await reach(/^清太/, /題箋を見る/);
  await p.waitForTimeout(200);
  await shot('slips');
  await p.getByRole('button', { name: '桜の題箋を買う（12文）' }).click();
  await p.waitForTimeout(200);
  ok((await p.locator('.shop .slip-owned').count()) === 1, 'the bought slip shows as owned');
  await p.locator('.shop').getByRole('button', { name: '町に戻る' }).click();
  ok((await save()).wallet.balanceMinor === m1 - 12, 'the slip cost 12文');

  await p.getByRole('button', { name: /^絵巻帳/ }).click();
  await p.locator('.slot.filled').first().click();
  await p.waitForTimeout(300);
  await p.locator('details.retitle summary').click();
  await p.getByRole('button', { name: '桜の題箋' }).click();
  await p.waitForTimeout(300);
  await shot('retitled');
  await p.reload();
  const s = await save();
  ok(s.journal.pages[0].titleStyle === 'sakura', `the first page keeps the 桜 slip after reloading (${s.journal.pages[0].titleStyle})`);
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
