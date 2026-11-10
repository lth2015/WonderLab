// 江戸編：全話を終えた存档（full-play.cjs が書き出す）から、六つの探し物をたどる。持ち主に
// 話しかけて落とし物の話を聞き、町の絵図に「？」が出ること、一覧から拾えること、持ち主に返せる
// こと、六つとも返すと宗吉にひと言あることを、通りに触れずに確かめる。
//   node apps/qingming-edo/e2e/lost.cjs <url> <save.json> [shot-dir]
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE, SHOTS] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node lost.cjs <url> <save.json> [shot-dir]');

const OWNERS = [/^金次/, /^お春/, /^清太/, /^亀吉/, /^喜助/];
const IDS = ['netsuke', 'kanzashi', 'sensu', 'koma', 'kiseru', 'suzu'];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const d = p.locator('.dialogue');
  const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('ww:qingming-edo:save')));
  const flags = async (pre) => (await save()).progress.flags.filter((f) => f.startsWith(pre)).sort();
  const finish = async () => {
    for (let i = 0; i < 30 && (await d.count()); i++) {
      const n = d.getByRole('button', { name: /^(次へ|閉じる)$/ });
      if (await n.count()) await n.first().click();
      else await d.getByRole('button', { name: '町に戻る' }).first().click();
      await p.waitForTimeout(100);
    }
  };
  const list = async (re) => {
    await p.getByRole('button', { name: '近くのこと' }).click();
    await p.waitForTimeout(150);
    const f = p.locator('details.fold:not(.more)');
    if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
    const item = f.locator('li button').filter({ hasText: re });
    if (!(await item.count())) throw new Error(`not in the list: ${re} — ${(await f.locator('li button').allInnerTexts()).join(' / ')}`);
    await item.first().click();
    await p.waitForTimeout(350);
  };
  const map = async (shot) => {
    await p.getByRole('button', { name: '町の絵図を開く' }).click();
    await p.waitForTimeout(300);
    const n = await p.locator('.town-map .map-lost').count();
    if (SHOTS && shot) await p.screenshot({ path: `${SHOTS}/${shot}.png` });
    await p.getByRole('button', { name: '町に戻る' }).last().click();
    await p.waitForTimeout(200);
    return n;
  };

  await p.goto(URL);
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), fs.readFileSync(SAVE, 'utf8'));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click();
  await p.waitForTimeout(400);
  const bad = [];
  const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) bad.push(msg); };

  ok((await map('map-0')) === 0, 'no ？ on the map before anyone speaks of a loss');
  // each owner, a few times: their everyday word (sets the "seen" flag on old saves), then the loss
  for (let round = 0; round < 4; round++) for (const re of OWNERS) { await list(re); await finish(); }
  const hints = await flags('lost_hint_');
  ok(hints.length === 6, `six losses heard (${hints.join(',')})`);
  const marks = await map('map-6');
  ok(marks === 6, `six ？ on the map (${marks})`);
  for (const id of IDS) {
    await list(/の落とし物/);
    await finish();
  }
  ok((await flags('lost_found_')).length === 6, 'all six picked up from the list');
  ok((await map()) === 0, 'the ？ are gone once found');
  await p.getByRole('button', { name: /持ち物/ }).first().click().catch(() => {});
  await p.waitForTimeout(200);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/carry.png` });
  await p.keyboard.press('Escape');
  for (let round = 0; round < 2; round++) for (const re of OWNERS) { await list(re); await finish(); }
  ok((await flags('lost_back_')).length === 6, 'all six given back');
  await list(/^宗吉/);
  await finish();
  ok((await flags('lost_allback')).length === 1, '宗吉 has his word');
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
