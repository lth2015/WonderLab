// 江戸編：会話の立ち絵と「町の人のこと」。全話を終えた存档から、話せる八人それぞれに
// 「少し話す」で町の人のことを聞き、立ち絵が出ること、聞ける人が並ぶこと、四つ話すと
// 締めのひとことで終わることを見る（即興のひとことは使わない：人のことは台本だけ）。
//   node apps/qingming-edo/e2e/talk.cjs <url> <save.json>
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node talk.cjs <url> <save.json>');
const PEOPLE = [/^宗吉/, /^清太/, /^お紺/, /^金次/, /^喜助/, /^お春/, /^おまつ/, /^伊兵衛/];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const d = p.locator('.dialogue');
  await p.goto(URL);
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), fs.readFileSync(SAVE, 'utf8'));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click();
  await p.waitForTimeout(400);
  const f = p.locator('details.fold:not(.more)');
  const open = async (re) => {
    await p.getByRole('button', { name: '近くのこと' }).click();
    await p.waitForTimeout(150);
    if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
    await f.locator('li button').filter({ hasText: re }).first().click();
    await p.waitForTimeout(350);
  };
  const bad = [];
  for (const re of PEOPLE) {
    // rumors and lost things come first: talk until the everyday word offers 「少し話す」
    let faced = false;
    for (let k = 0; k < 8 && !(await d.getByRole('button', { name: /少し話す/ }).count()); k++) {
      if (!(await d.count())) await open(re);
      faced ||= (await d.locator('img.face').count()) > 0;
      const n = d.getByRole('button', { name: /^(次へ|閉じる|町に戻る)$/ });
      if (!(await d.getByRole('button', { name: /少し話す/ }).count()) && (await n.count())) await n.first().click();
      await p.waitForTimeout(120);
    }
    const talk = d.getByRole('button', { name: /少し話す/ });
    if (!(await talk.count())) { bad.push(`${re.source}: no 少し話す`); continue; }
    await talk.first().click();
    await p.waitForTimeout(250);
    const said = [];
    for (let t = 0; t < 4; t++) {
      const more = p.getByRole('button', { name: '町の人のこと…' });
      if (!(await more.count())) break;
      await more.click();
      await p.locator('.talk .choices.about button').first().click();
      await p.waitForTimeout(150);
      said.push(await p.locator('.talk .said').first().innerText());
    }
    const closing = await p.getByRole('button', { name: '閉じる' }).count();
    const face = await p.locator('.talk img.face').count();
    const ok = faced && face && said.length >= 3 && closing;
    console.log(`${ok ? '✓' : '✗'} ${re.source.slice(1)}: ${said.length} people asked about, portrait ${face ? 'yes' : 'no'}, ends ${closing ? 'yes' : 'no'} — 「${said[0]?.slice(0, 24)}…」`);
    if (!ok) bad.push(re.source);
    if (closing) await p.getByRole('button', { name: '閉じる' }).click();
    else await p.getByRole('button', { name: /町に戻る|ほかの話にする/ }).first().click();
    await p.waitForTimeout(200);
  }
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
