// npm run analyze -- <session logs...> [--notes notes.json] [--out report.md]
//
// Reads the logs the moderator exported (Alt+Shift+E, one JSON per tester)
// and prints the H1–H3 verdicts as Markdown (src/lib/sessions.ts). The
// optional notes file holds what only the observer saw, keyed by log file
// name:
//
//   { "wonderlab-session-1761100000000.json": { "helpBeforeFirstStroke": false, "h3Observation": { "status": "spontaneous", "evidence": "自由段结束回来时、提问前主动问怎么发给朋友" } } }

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { analyzeStudy, formatReport, isSessionLog, type ObserverNotes } from '../src/lib/sessions';

const args = process.argv.slice(2);
const take = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const notesPath = take('--notes');
const outPath = take('--out');
if (!args.length) {
  console.error('usage: npm run analyze -- <session logs...> [--notes notes.json] [--out report.md]');
  process.exit(1);
}

const notes: Record<string, ObserverNotes> = notesPath ? JSON.parse(readFileSync(notesPath, 'utf8')) : {};
const sessions = [];
for (const file of args) {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isSessionLog(data)) {
    console.error(`skipped ${file}: not a WonderLab session log`);
    continue;
  }
  const id = basename(file);
  sessions.push({ id, log: data, notes: notes[id] });
}
const unmatched = Object.keys(notes).filter((k) => !sessions.some((s) => s.id === k));
if (unmatched.length) console.error(`notes for logs that were not given: ${unmatched.join(', ')}`);

const report = formatReport(analyzeStudy(sessions));
if (outPath) writeFileSync(outPath, report);
else process.stdout.write(report);
