// 江戸編：新しい存档から十二の故事を全部、通りに触れずに終える（一覧・対話のボタン・
// 上の時刻と晴雨・矢印キーだけ）。章の開き方、キーボードだけで遊べること、故事どうしの
// つながりを一度に確かめる。手動で回す（CI では回さない）。
//   node apps/qingming-edo/e2e/full-play.cjs <url> [save.json]   例: http://localhost:4173/edo/
//   save.json を渡すと、終わったときの存档を書き出す（recall.cjs が続きに使う）。
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.argv[2];
const SAVE_OUT = process.argv[3];
if (!URL) throw new Error('usage: node full-play.cjs <url>');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const t0 = Date.now();
  const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);
  const d = p.locator('.dialogue');
  const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('ww:qingming-edo:save')));
  const btn = (name) => p.getByRole('button', { name, exact: typeof name === 'string' });

  /** Read on to the choices (or the end); returns the choice labels, or [] if the dialogue closed. */
  const readOn = async () => {
    for (let i = 0; i < 20; i++) {
      if (!(await d.count())) return [];
      if (await d.locator('.choices').count()) return d.locator('.choices button').allInnerTexts();
      const n = d.getByRole('button', { name: /^(次へ|閉じる)$/ });
      if (!(await n.count())) return [];
      await n.first().click();
      await p.waitForTimeout(80);
    }
    throw new Error('dialogue did not end');
  };
  const choose = async (re) => {
    const labels = await readOn();
    if (!labels.length) throw new Error(`no choices for ${re}`);
    const c = d.locator('.choices button').filter({ hasText: re });
    if (!(await c.count())) throw new Error(`no choice ${re} in ${labels.join(' / ')}`);
    await c.first().click();
    await p.waitForTimeout(150);
  };
  const finish = async () => {
    for (let i = 0; i < 20 && (await d.count()); i++) {
      const labels = await readOn();
      if (!labels.length) continue;
      // an everyday word may offer only 「少し話す」 (and 喜助's tea, 清太's slips): leave it there
      if (labels.every((l) => /少し話す|一服する|題箋を見る/.test(l))) {
        await d.getByRole('button', { name: '町に戻る' }).click();
        await p.waitForTimeout(120);
        continue;
      }
      throw new Error(`unexpected choices: ${labels.join(' / ')}`);
    }
  };
  const list = async (re) => {
    await btn('近くのこと').click();
    await p.waitForTimeout(150);
    const f = p.locator('details.fold:not(.more)');
    if (!(await f.evaluate((x) => x.open))) await f.locator('summary').click();
    const item = f.locator('li button').filter({ hasText: re });
    if (!(await item.count())) throw new Error(`not in the list: ${re} — ${(await f.locator('li button').allInnerTexts()).join(' / ')}`);
    await item.first().click();
    await p.waitForTimeout(350);
  };
  const talk = async (re) => {
    await list(re);
    if (!(await d.count())) throw new Error(`nothing opened for ${re}`);
  };
  const time = async (label) => {
    await p.locator('.top .time').first().click();
    await p.getByRole('menuitemradio', { name: label }).click();
    await p.waitForTimeout(300);
  };
  const rain = async (on) => {
    const w = p.locator('.top .weather');
    if ((await w.getAttribute('aria-pressed')) !== String(on)) await w.click();
    await p.waitForTimeout(200);
  };
  const done = async (q) => {
    const s = await save();
    if (s.progress.quests[q] !== 'complete') throw new Error(`${q} is not complete (${s.progress.quests[q]})`);
    log(`✓ ${q}  pages ${s.journal.pages.length}, 文 ${s.wallet.balanceMinor}`);
  };

  await p.goto(URL);
  await btn('絵巻に入る').click();
  await p.waitForTimeout(500);

  // 一 風のいたずら
  await list(/青葉屋の店先の紙/);
  await choose(/働く手を描く/);
  await btn('この頁にする').click();
  await p.waitForTimeout(150);
  await finish();
  await done('kaze');

  // 二 いつもの道具（包みは一覧の代わりにボタンで置く）
  await talk(/^お紺/);
  await choose(/包むのを手伝う/);
  for (const [item, cloth] of [[/塗り直した弁当箱/, /^波の印の布/], [/^箸箱/, /^菱の印の布/], [/^砥石/, /^丸の印の布/]]) {
    await p.getByRole('button', { name: item }).click();
    await p.getByRole('button', { name: cloth }).click();
  }
  await btn('布を折る').click();
  await btn('結ぶ').click();
  await btn('お紺に渡す').click();
  await p.waitForTimeout(150);
  await choose(/お春さんに託す/);
  await finish();
  await done('dougu');

  // 二 あの人の手拭い
  await talk(/^お春/);
  await choose(/一緒に探す/);
  await finish();
  await talk(/^喜助/);
  await choose(/お茶を運ぶ/);
  await p.getByRole('region', { name: '朝の仕事帰りの大工' }).getByRole('button', { name: /冷たい麦湯と団子/ }).click();
  await p.getByRole('region', { name: '三味線の女師匠' }).getByRole('button', { name: /ぬるめの煎茶と煎餅/ }).click();
  await btn('お茶を出す').click();
  await btn('二人の話を聞く').click();
  await p.waitForTimeout(150);
  await choose(/手拭いを見比べる/);
  await p.getByRole('button', { name: 'これがご隠居さんの' }).nth(0).click();
  await finish();
  await talk(/^お春/);
  await finish();
  await done('tenugui');

  // 二 母への文
  await list(/道に落ちている文/);
  await choose(/拾って追いかける/);
  await finish();
  await talk(/^伊兵衛/);
  await choose(/./);
  await finish();
  await done('fumi');

  // 三 河岸の朝
  await time('昼');
  await talk(/^おまつ/);
  await choose(/./);
  await finish();
  await talk(/^亀吉/);
  await choose(/./);
  await finish();
  const s3 = await save();
  if (s3.progress.quests.kashi !== 'complete') {
    await talk(/^亀吉|^おまつ/);
    await finish();
  }
  await done('kashi');

  // 三 朝の藍
  await time('朝');
  await talk(/^宗吉/);
  await choose(/藍を探しに行く/);
  await finish();
  for (const re of [/くれ竹の藍の暖簾/, /紺屋の藍甕/, /干し場の藍の布/]) {
    await list(re);
    await finish();
  }
  await talk(/^宗吉/);
  await choose(/藍甕の深い藍/);
  await finish();
  await done('ai');

  // 三 茶店の猫（喜助のいつもの礼を一度聞いてから）
  await time('昼');
  await talk(/^喜助/);
  if (await d.locator('.said, .narration').filter({ hasText: 'こはく' }).count()) {
    /* already asks */
  }
  let asked = false;
  for (let k = 0; k < 3 && !asked; k++) {
    const labels = await readOn();
    if (labels.some((l) => /探してみる/.test(l))) {
      await choose(/探してみる/);
      asked = true;
    } else {
      await finish();
      await talk(/^喜助/);
    }
  }
  if (!asked) throw new Error('喜助 never asked about the cat');
  await finish();
  for (const re of [/井戸のふちの三毛猫/, /米俵の前の三毛猫/]) {
    await list(re);
    await p.waitForTimeout(1500); // it leaps away
  }
  await list(/堀の河岸の三毛猫/);
  await choose(/隣にしゃがんで/);
  await finish();
  await talk(/^喜助/);
  await choose(/./);
  await finish();
  await done('neko');

  // 四 夕暮れの灯
  await time('夕');
  await talk(/^喜助/);
  await choose(/点けて回る/);
  await finish();
  for (const re of [/橋のたもとの石灯籠/, /米屋のそばの提灯/, /堀の河岸の提灯/]) {
    await list(re);
    await finish();
  }
  await talk(/^喜助/);
  await choose(/./);
  await finish();
  await done('yube');

  // 四 雨宿り
  await rain(true);
  await talk(/^喜助/);
  await choose(/傘を届けに行く/);
  await finish();
  for (const re of [/呉服屋の軒下の武士/, /米屋の軒先の魚売り/, /瀬戸物屋の軒下の丁稚/]) {
    await list(re);
    await finish();
  }
  await talk(/^喜助/);
  await choose(/./);
  await finish();
  await rain(false);
  await done('ame');

  // 四 動く人を描く（枠を通るのを待って描く）
  await time('昼');
  await talk(/^宗吉/);
  // 橋のたもと is open by now and 宗吉 asks it first: put it off, and his lesson comes next
  if ((await readOn()).some((l) => /声をかけに行く/.test(l))) {
    await choose(/またにする/);
    await finish();
    log('put off 橋のたもと once');
    await talk(/^宗吉/);
  }
  await choose(/やってみる/);
  await finish();
  await list(/日傘の娘.*待って描く/);
  await d.waitFor({ timeout: 70000 });
  await finish();
  await done('ugoki');

  // 四 ご隠居の散歩（矢印キーで一緒に歩く）
  await talk(/^ご隠居/);
  await choose(/いっしょに歩く/);
  await finish();
  const st = p.locator('.street');
  const box = await st.boundingBox();
  const walkStart = Date.now();
  while (!(await d.count())) {
    if (Date.now() - walkStart > 240000) throw new Error('never arrived at the bench');
    const x = await p.locator('[data-walker="inkyo-walk"]').getAttribute('transform').then((t) => (t ? +t.match(/translate\(([\d.]+)/)[1] : null)).catch(() => null);
    const cam = +(await st.getAttribute('data-cam'));
    const mid = cam + box.width / +(await st.getAttribute('data-scale')) / 2;
    if (x !== null && mid > x - 40) {
      await st.focus();
      await p.keyboard.press('ArrowLeft');
    }
    await p.waitForTimeout(400);
  }
  log(`walked with ご隠居 for ${((Date.now() - walkStart) / 1000).toFixed(0)} s`);
  await choose(/./);
  await finish();
  await done('inkyo');

  // 終 橋のたもと
  await talk(/^宗吉/);
  await choose(/声をかけに行く/);
  await finish();
  for (const re of [/^お紺/, /^喜助/, /^おまつ/, /^伊兵衛/]) {
    await talk(re);
    await finish();
  }
  await talk(/^宗吉/);
  await choose(/./);
  await finish();
  await done('hashi');

  const s = await save();
  if (SAVE_OUT) fs.writeFileSync(SAVE_OUT, JSON.stringify(s));
  const left = Object.entries(s.progress.quests).filter(([, v]) => v !== 'complete');
  log(`all done: ${Object.keys(s.progress.quests).length} stories, not complete: ${left.map(([k]) => k).join(',') || 'none'}; pages ${s.journal.pages.length}; 文 ${s.wallet.balanceMinor}; page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (left.length || errs.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
