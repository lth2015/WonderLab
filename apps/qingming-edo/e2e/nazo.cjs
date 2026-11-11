// 江戸編：宗吉の謎かけ。通して遊んだ存档に落とし物を全部返した印をつけ、宗吉に話すと、落とし物の
// ひとことのあとに謎かけが始まること、持ち物に謎が出ること、一つ目の答えでない所では何も見つからないこと、
// 答えの所（近くのことの一覧から）で下絵が見つかり、宗吉に見せると次の謎が出ること、三枚そろうと持ち物に
// 「宗吉の若いころの下絵（三枚）」が残ることを見る。
//   node apps/qingming-edo/e2e/nazo.cjs <url> <save.json> [shot-dir]
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE, SHOTS] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node nazo.cjs <url> <save.json> [shot-dir]');
const LOST = ['netsuke', 'kanzashi', 'sensu', 'koma', 'kiseru', 'suzu'];
(async () => {
  const save = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  save.progress.flags = [...save.progress.flags.filter((x) => !/^(lost_|nazo_)/.test(x)), ...LOST.flatMap((t) => [`lost_found_${t}`, `lost_back_${t}`, `lost_hint_${t}`])];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [], bad = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) bad.push(m); };
  const d = p.locator('.dialogue');
  const f = p.locator('details.fold:not(.more)');
  const said = async () => (await d.locator('.said, .narration').allInnerTexts()).join(' ');
  // reads a dialogue to its end, returns all it said
  const readAll = async () => {
    const lines = [];
    await d.waitFor({ timeout: 3000 });
    for (let i = 0; i < 14; i++) {
      lines.push(await said());
      if (await d.locator('.choices').count()) { await d.getByRole('button', { name: '町に戻る' }).click(); break; }
      const btn = d.getByRole('button', { name: /^(次へ|閉じる)$/ });
      const close = /閉じる/.test(await btn.innerText());
      await btn.click(); await p.waitForTimeout(150);
      if (close) break;
    }
    await p.waitForTimeout(300);
    return lines.join(' ');
  };
  const call = async (re) => {
    await p.getByRole('button', { name: '近くのこと' }).click(); await p.waitForTimeout(200);
    if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
    await f.locator('li button').filter({ hasText: re }).first().click(); await p.waitForTimeout(500);
  };
  const toSokichi = async () => {
    await p.getByRole('button', { name: /^絵巻帳/ }).click();
    await p.getByRole('button', { name: '町の人' }).click(); await p.waitForTimeout(300);
    await p.locator('.person').filter({ hasText: '宗吉' }).first().getByRole('button', { name: '会いに行く' }).click(); await p.waitForTimeout(900);
    await call(/^宗吉/);
    return readAll();
  };
  const items = async () => {
    await p.getByRole('button', { name: /持ち物/ }).first().click(); await p.waitForTimeout(250);
    const t = await p.locator('.panel').innerText();
    await p.getByRole('button', { name: '町に戻る' }).click(); await p.waitForTimeout(250);
    return t;
  };
  await p.goto(URL);
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), JSON.stringify(save));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click(); await p.waitForTimeout(700);
  const start = await toSokichi();
  ok(/下を見て歩く/.test(start) && /下絵を、三枚/.test(start) && /空を映す鏡/.test(start), `宗吉: the lost things, then the hunt and the first riddle`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/nazo-items.png` });
  ok(/宗吉の謎（一つ目）/.test(await items()), '持ち物 keeps the riddle');
  // the wrong place finds nothing
  await call(/^干された藍染/);
  // (it may open its sketch, if not drawn yet: that is all it does)
  const wrong = (await d.isVisible().catch(() => false)) ? await readAll() : '';
  ok(!/包み/.test(wrong), `the second answer finds nothing yet${wrong ? `: ${wrong.slice(0, 20)}…` : ''}`);
  // passers-by can be asked: the fishmonger knows the first (water), the samurai cannot tell
  const askPasser = async (re) => {
    await call(re);
    for (let i = 0; i < 6 && !(await d.locator('.choices').count()); i++) { await d.getByRole('button', { name: /^次へ$/ }).click(); await p.waitForTimeout(120); }
    const q = d.locator('.choices button').filter({ hasText: '宗吉さんの謎' });
    if (!(await q.count())) { await d.getByRole('button', { name: '町に戻る' }).click(); await p.waitForTimeout(250); return null; }
    await q.click(); await p.waitForTimeout(200);
    return readAll();
  };
  const fish = await askPasser(/^魚売り/);
  ok(fish && /庭の池/.test(fish), `the fishmonger's hint: ${(fish ?? '(no question)').slice(0, 30)}…`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/nazo-hint.png` });
  const sam = await askPasser(/^通りがかりの武士/);
  ok(sam && /頭が固く/.test(sam), `the samurai cannot tell: ${(sam ?? '(no question)').slice(0, 24)}…`);
  const answers = [/^庭の池/, /^干された藍染/, /^店先の幟/];
  const next = [/青い川/, /店の名を背負って/, /三枚そろった/];
  for (let i = 0; i < 3; i++) {
    await call(answers[i]);
    const found = await readAll();
    ok(/油紙の包み|最後の包み/.test(found), `found at ${answers[i]}: ${found.slice(0, 26)}…`);
    if (SHOTS && i === 0) await p.screenshot({ path: `${SHOTS}/nazo-found.png` });
    ok(/見つけた下絵/.test(await items()), '持ち物: a sketch to show');
    const shown = await toSokichi();
    ok(next[i].test(shown), `宗吉 sees it: ${shown.slice(0, 30)}…`);
  }
  ok((await askPasser(/^魚売り/)) === null, 'with no riddle open, the question is not there');
  const last = await items();
  ok(/宗吉の若いころの下絵（三枚）/.test(last) && !/宗吉の謎/.test(last), '持ち物 keeps the three sketches');
  const again = await toSokichi();
  ok(!/三枚そろった|下絵を、三枚/.test(again), `宗吉 does not repeat it: ${again.slice(0, 24)}…`);
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
