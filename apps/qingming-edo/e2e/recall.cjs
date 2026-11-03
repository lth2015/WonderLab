// 江戸編：全話を終えた存档（full-play.cjs が書き出す）から、四頁目以降の九つの故事を
// 絵巻帳の「この場面を回想する」でたどり直し、もう一つの結末を選んで「もう一枚」の頁が
// 残ることを確かめる。回想では文が増えないことも見る。
//   node apps/qingming-edo/e2e/recall.cjs <url> <save.json>
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node recall.cjs <url> <save.json>');

const STORIES = [
  ['p04-kashi', '河岸の朝'], ['p05-fumi', '母への文'], ['p06-yube', '夕暮れの灯'], ['p07-ai', '朝の藍'], ['p08-hashi', '橋のたもと'],
  ['p09-neko', '茶店の猫'], ['p10-inkyo', 'ご隠居の散歩'], ['p11-ugoki', '動く人を描く'], ['p12-ame', '雨宿り'],
];
const PUT_OFF = /またにする|また後で|眺めるだけ|そっと手を伸ばす|今は町を見て回りたい|そのままにしておく/;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const d = p.locator('.dialogue');
  const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('ww:qingming-edo:save')));
  await p.goto(URL);
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), fs.readFileSync(SAVE, 'utf8'));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click();
  await p.waitForTimeout(400);
  const money0 = (await save()).wallet.balanceMinor;
  const bad = [];
  for (const [pageId, title] of STORIES) {
    await p.getByRole('button', { name: /^絵巻帳/ }).click();
    await p.getByRole('button', { name: `${title}を開く`, exact: true }).click();
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'この場面を回想する' }).click();
    await p.waitForTimeout(300);
    const picked = [];
    for (let step = 0; step < 40 && (await d.count()); step++) {
      if (await d.locator('.choices').count()) {
        const labels = await d.locator('.choices button').allInnerTexts();
        // take the request (not 「またにする」); at an ending, the other one (the last)
        const putOff = labels.some((l) => PUT_OFF.test(l));
        const i = putOff ? labels.findIndex((l) => !PUT_OFF.test(l)) : labels.length - 1;
        picked.push(labels[i]);
        await d.locator('.choices button').nth(i).click();
      } else {
        const n = d.getByRole('button', { name: /^(次へ|閉じる|回想を閉じる)$/ });
        if (!(await n.count())) break;
        await n.first().click();
      }
      await p.waitForTimeout(120);
    }
    const s = await save();
    const got = s.journal.pages.some((x) => x.pageId === `${pageId}-b`);
    console.log(`${got ? '✓' : '✗'} ${title.padEnd(8)} ${pageId}-b ${got ? 'left' : 'MISSING'}   (chose: ${picked.join(' → ')})`);
    if (!got) bad.push(title);
  }
  // 町の写生: the seven places, each drawn once (「なぞらずに描く」, the keyboard way)
  for (let k = 0; k < 7; k++) {
    await p.getByRole('button', { name: '近くのこと' }).click();
    await p.waitForTimeout(150);
    const f = p.locator('details.fold:not(.more)');
    if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
    const item = f.locator('li button').filter({ hasText: '写生できる' });
    if (!(await item.count())) break;
    const name = (await item.first().innerText()).replace(/\s*（写生できる）/, '');
    await item.first().click();
    await p.waitForTimeout(300);
    for (let i = 0; i < 4 && !(await d.locator('.choices').count()); i++) await d.getByRole('button', { name: /^次へ$/ }).click();
    await d.getByRole('button', { name: 'この景色を写す' }).click();
    await p.getByRole('button', { name: 'なぞらずに描く' }).click();
    await p.waitForTimeout(1200);
    for (let i = 0; i < 4 && (await d.count()); i++) await d.getByRole('button', { name: /^(次へ|閉じる)$/ }).first().click();
    console.log(`✓ 写生 ${name}`);
  }
  const s = await save();
  console.log(`pages ${s.journal.pages.length}; 文 ${money0} → ${s.wallet.balanceMinor} (回想 adds none); page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length || s.wallet.balanceMinor !== money0) process.exit(1);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
