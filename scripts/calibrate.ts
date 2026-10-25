// npm run calibrate -- [strokes/*.json...] [--synthetic] [--sweep] [--out report.md]
//
// Scores the docs/03 §6.2 thresholds against strokes from ?collect (by
// default every file in strokes/) and prints a Markdown report: each shape's
// outcomes, the docs/02 §5.2 acceptance, the strokes read wrongly with their
// measurements, and with --sweep the threshold sets that would read best.
// --synthetic uses the seeded stand-in study (src/collect/synth.ts) instead.
// Nothing is changed: a person edits THRESHOLDS and 03 §6.2 by hand.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { THRESHOLDS, type Thresholds } from '../src/engine/classify';
import { ACCEPTANCE, evaluate, measureAll, styleSplits, sweep, type Evaluation, type Measured } from '../src/collect/calibrate';
import { CATEGORIES, OUTCOME_LABEL, isSession, type Session } from '../src/collect/protocol';
import { syntheticStudy } from '../src/collect/synth';

const args = process.argv.slice(2);
const flag = (f: string) => {
  const i = args.indexOf(f);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const take = (f: string): string | undefined => {
  const i = args.indexOf(f);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const synthetic = flag('--synthetic');
const doSweep = flag('--sweep');
const outPath = take('--out');

const sessions: { name: string; session: Session }[] = [];
if (synthetic) {
  for (const s of syntheticStudy()) sessions.push({ name: s.tester, session: s });
} else {
  const files = args.length ? args : readdirSync('strokes').filter((f) => f.endsWith('.json')).map((f) => join('strokes', f));
  for (const file of files) {
    const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!isSession(data)) {
      console.error(`skipped ${file}: not a ?collect export`);
      continue;
    }
    sessions.push({ name: basename(file), session: data });
  }
}
if (!sessions.length) {
  console.error('no strokes: put ?collect exports in strokes/ (see strokes/README.md), or pass --synthetic');
  process.exit(1);
}

const owner = new Map<object, string>();
const measured: Measured[] = [];
for (const { session } of sessions) {
  for (const m of measureAll(session.samples)) {
    owner.set(m, `${session.tester} (${session.device})`);
    measured.push(m);
  }
}

const pct = (v: number) => (Number.isNaN(v) ? '—' : `${(v * 100).toFixed(0)}%`);
const tick = (ok: boolean) => (ok ? '✓' : '✗');
const fmt = (n: number, d = 2) => n.toFixed(d);

function table(e: Evaluation): string[] {
  const out = ['| 形状 | 正确 | 判定分布 |', '|---|---|---|'];
  for (const c of e.categories) {
    if (!c.total) continue;
    const dist = Object.entries(c.outcomes)
      .map(([k, n]) => `${OUTCOME_LABEL[k as keyof typeof OUTCOME_LABEL]} ${n}`)
      .join('、');
    out.push(`| ${c.label} | ${c.correct}/${c.total} | ${dist} |`);
  }
  return out;
}

function acceptance(e: Evaluation): string[] {
  return [
    `- ${tick(!(e.circleRate < ACCEPTANCE.circleRate))} 手画圆和歪圆判为圆：${pct(e.circleRate)}（要求 ≥ ${pct(ACCEPTANCE.circleRate)}）`,
    `- ${tick(!(e.fishAsCircle > ACCEPTANCE.fishAsCircle))} 鱼形轮廓误判为圆：${pct(e.fishAsCircle)}（要求 ≤ ${pct(ACCEPTANCE.fishAsCircle)}）`,
    `- ${tick(e.spiralOrUAsCircle === 0)} 螺旋和 U 形误判为圆：${e.spiralOrUAsCircle} 笔（要求 0）`,
  ];
}

const changed = (T: Thresholds) =>
  (Object.keys(T) as (keyof Thresholds)[])
    .filter((k) => T[k] !== THRESHOLDS[k])
    .map((k) => `${k} ${THRESHOLDS[k]} → ${T[k]}`)
    .join('，') || '（不变）';

const e = evaluate(measured, THRESHOLDS, (m) => owner.get(m) ?? '');
const testers = new Set(sessions.map((s) => s.session.tester)).size;
const lines: string[] = [
  `# 笔迹判定校准报告`,
  '',
  `数据：${synthetic ? '合成笔迹（替身，不能单独作为调参依据）' : `${sessions.length} 个文件`}，${testers} 位测试者，${e.total} 笔。阈值见 docs/03 §6.2。`,
  '',
  `## 验收（docs/02 §5.2）：${e.meetsAcceptance ? '通过' : '未通过'}`,
  '',
  ...acceptance(e),
  '',
  `总体正确 ${e.correct}/${e.total}（${pct(e.correct / e.total)}）。`,
  '',
  '## 各形状',
  '',
  ...table(e),
  '',
];

if (e.misses.length) {
  lines.push(
    '## 判错的笔',
    '',
    '| 形状 | 判为 | 测试者 | 指针 | 长度 | 首尾距 | 转角 | 绕心角 | 长宽比 | 残差 |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const m of e.misses) {
    const label = CATEGORIES.find((c) => c.id === m.category)?.label ?? m.category;
    const f = m.features;
    const cols = f
      ? [fmt(f.length, 0), fmt(f.gap), fmt(f.turn, 0) + '°', fmt(f.sweep, 0) + '°', fmt(f.aspect), fmt(f.fit.residual, 3)]
      : ['—', '—', '—', '—', '—', '—'];
    lines.push(`| ${label} | ${OUTCOME_LABEL[m.outcome]} | ${m.tester ?? ''} | ${m.pointerType} | ${cols.join(' | ')} |`);
  }
  lines.push('');
}

// 笔性 (koi-style.ts): where fast and slow divide, per pointer type.
const splits = styleSplits(sessions.flatMap((x) => x.session.samples));
if (splits.length) {
  lines.push(
    '## 笔性分界（花色倾向）',
    '',
    '「画鱼的一笔」的速度（画面短边 / 秒）和弯度（总转角 / π）。分界设在中位数时，快、慢各占一半。',
    '',
    '| 指针 | 笔数 | 速度 25% / 50% / 75% | 弯度中位数 | 现在的分界 | 建议 | 现在的四族分布（利落 / 热闹 / 沉静 / 圆润） |',
    '|---|---|---|---|---|---|---|',
  );
  for (const x of splits) {
    const f = x.families;
    lines.push(
      `| ${x.pointerType} | ${x.n} | ${x.speed.map((v) => fmt(v)).join(' / ')} | ${fmt(x.curviness)} | ${fmt(x.current)} | ${fmt(x.suggested)} | ${f.brisk} / ${f.lively} / ${f.calm} / ${f.round} |`,
    );
  }
  lines.push('', '改分界：`src/engine/koi-style.ts` 的 `STYLE.fastSplit`，同步更新 03 §6.2。', '');
}

if (doSweep) {
  lines.push('## 阈值候选（只是建议）', '', '按「满足验收 → 判对的笔最多 → 改动最小」排序。', '');
  for (const [i, c] of sweep(measured).entries()) {
    lines.push(
      `${i + 1}. ${tick(c.evaluation.meetsAcceptance)} 正确 ${c.evaluation.correct}/${c.evaluation.total}，圆 ${pct(c.evaluation.circleRate)}，鱼→圆 ${pct(c.evaluation.fishAsCircle)}：${changed(c.thresholds)}`,
    );
  }
  lines.push('');
}

const report = lines.join('\n');
if (outPath) writeFileSync(outPath, report);
else process.stdout.write(report);
