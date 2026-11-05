// 江戸編：人物帳（絵巻帳の「町の人」）。全話を終えた存档から、出会った人が立ち絵・なじみ・
// ともにしたことと並ぶこと、「会いに行く」で通りがその人のところへ動くことを見る。
//   node apps/qingming-edo/e2e/people.cjs <url> <save.json>
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, SAVE] = process.argv.slice(2);
if (!URL || !SAVE) throw new Error('usage: node people.cjs <url> <save.json>');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL);
  const save = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  await p.evaluate((v) => localStorage.setItem('ww:qingming-edo:save', v), JSON.stringify(save));
  await p.reload();
  await p.getByRole('button', { name: /絵巻/ }).first().click();
  await p.waitForTimeout(400);
  const bad = [];
  const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) bad.push(msg); };
  await p.getByRole('button', { name: /^絵巻帳/ }).click();
  await p.getByRole('button', { name: '町の人' }).click();
  await p.waitForTimeout(300);
  const met = new Set(['sokichi', ...save.progress.flags.filter((f) => f.startsWith('met_')).map((f) => f.slice(4)), ...Object.keys(save.progress.familiarity)]);
  const n = await p.locator('.person').count();
  ok(n === met.size, `${n} people in the book (met ${met.size})`);
  ok((await p.locator('.person img.face').count()) === n, 'each with a portrait');
  ok((await p.locator('.person .najimi').count()) === n, 'each with なじみ');
  const sokichi = await p.locator('.person').first().innerText();
  ok(/宗吉/.test(sokichi) && /ともにしたこと/.test(sokichi), '宗吉 first, with the stories shared');
  const before = +(await p.locator('[data-cam]').getAttribute('data-cam'));
  await p.locator('.person').filter({ hasText: '河岸の魚売り' }).first().getByRole('button', { name: '会いに行く' }).click();
  await p.waitForTimeout(900);
  const cam = +(await p.locator('[data-cam]').getAttribute('data-cam'));
  ok(Math.abs(cam - 14500) < 600 && cam !== before, `会いに行く brings the street to おまつ (camera ${Math.round(before)} → ${Math.round(cam)})`);
  console.log(`page errors ${errs.length ? errs.join(' | ') : 'none'}`);
  await b.close();
  if (bad.length || errs.length) process.exit(1);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
