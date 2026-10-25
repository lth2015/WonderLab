// npm run sentences -- <sentences.txt...> [--out report.md]
//
// Runs sentences through the local rules of 一句成境 (src/engine/intent.ts)
// and prints what the world would do with each, as Markdown: first the ten
// fixed R1 sentences (recorded, never tuned for), then the rule calibration
// set, one sentence per line, `#` lines ignored. Run it before and after a
// rule change and keep both reports: that is the record docs/验证路线图.md
// asks for. A keyword hit is a diagnostic, not proof the world understood.
// Nothing is changed and nothing is sent anywhere.

import { readFileSync, writeFileSync } from 'node:fs';
import { FIXED_SENTENCES } from '../src/engine/fixed-sentences';
import { interpret } from '../src/engine/intent';

const args = process.argv.slice(2);
const at = args.indexOf('--out');
const outPath = at >= 0 ? args.splice(at, 2)[1] : undefined;

const sentences = args.flatMap((file) =>
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')),
);

const cell = (s: string) => s.replace(/\|/g, '\\|');
function table(list: readonly string[]): string[] {
  const rows = list.map((s) => {
    const r = interpret(s);
    const what = Object.entries(r.command)
      .filter(([k]) => k !== 'intensity')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    return { s, source: r.source, line: `| ${cell(s)} | ${r.source === 'keyword' ? '关键词' : '情绪判断'} | ${r.mood} | ${what || '—'} |` };
  });
  const hits = rows.filter((r) => r.source === 'keyword').length;
  return [`关键词命中 ${hits}/${rows.length}（诊断指标，不是理解准确率）`, '', '| 句子 | 规则 | 情绪 | 世界的变化 |', '|---|---|---|---|', ...rows.map((r) => r.line), ''];
}

const out = [
  '# 一句成境：本地规则检查',
  '',
  '## 固定测试句（R1 统一输入，只记录，不作为调规则的目标）',
  '',
  ...table(FIXED_SENTENCES),
  '## 规则校准集',
  '',
  ...(sentences.length ? table(sentences) : ['（没有给出句子文件）', '']),
];
if (outPath) writeFileSync(outPath, out.join('\n'));
else process.stdout.write(out.join('\n'));
