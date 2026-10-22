#!/usr/bin/env node
// Stage D: summarise moderated test sessions (docs/05, docs/07).
//
//   npm run analyze              # reads sessions/, writes sessions/report.md
//   npm run analyze -- other/dir
//
// In the folder: one exported event log per tester, named after the tester
// (P01.json, P02.json …; the file Alt+Shift+E downloads, renamed), and
// notes.json with the observer's notes:
//   [{ "tester": "P01", "askedForHelp": false, "askedToSend": true }, …]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { evaluate, measure, report } from '../src/analysis/sessions.ts';

const dir = process.argv[2] ?? 'sessions';
const files = (await readdir(dir)).filter((f) => f.endsWith('.json') && f !== 'notes.json').sort();
if (!files.length) {
  console.error(`${dir}/ 里没有事件日志（P01.json 这样的文件）。见 sessions/README.md。`);
  process.exit(1);
}

let notes = [];
try {
  notes = JSON.parse(await readFile(join(dir, 'notes.json'), 'utf8'));
} catch {
  console.warn('没有 notes.json：求助、主动问怎么发送这两项会记为未知，H1 和 H3 的判定会是「不确定」。');
}

const testers = [];
for (const f of files) {
  const tester = basename(f, '.json');
  const log = JSON.parse(await readFile(join(dir, f), 'utf8'));
  if (!Array.isArray(log.events)) {
    console.warn(`跳过 ${f}：不是导出的事件日志`);
    continue;
  }
  testers.push(measure(log, notes.find((n) => n.tester === tester) ?? { tester }));
}

const results = evaluate(testers);
const md = report(testers, results);
await writeFile(join(dir, 'report.md'), md);
console.log(md);
console.log(`已写入 ${join(dir, 'report.md')}`);
