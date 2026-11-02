#!/usr/bin/env node
// Summarises exported playtest records (江户 qingming-edo / 中国 qingming-china).
// usage: node summarize.mjs <folder with exported .json files>
// Reads only the fixed fields of the shared schema; never prints save contents.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node summarize.mjs <folder>');
  process.exit(1);
}
const sessions = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  let rec;
  try {
    rec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch {
    console.warn(`skip ${f}: not JSON`);
    continue;
  }
  if (!rec || !Array.isArray(rec.events) || !/^qingming-(edo|china)$/.test(rec.world_id)) {
    console.warn(`skip ${f}: not a playtest record`);
    continue;
  }
  const ev = rec.events;
  const first = (type) => ev.find((e) => e.type === type);
  const fi = first('first_interaction_completed');
  const done = ev.find((e) => e.type === 'story_completed' && e.first_completion === true);
  sessions.push({
    file: f,
    world: rec.world_id === 'qingming-edo' ? 'edo' : 'china',
    build: rec.build_id,
    dropped: rec.dropped ?? 0,
    firstMs: fi ? fi.elapsed_ms : null,
    firstWhat: fi ? fi.interaction_id : '',
    storyMs: done ? done.elapsed_ms : null,
    story: done ? done.story_id : '',
    started: [...new Set(ev.filter((e) => e.type === 'story_started').map((e) => e.story_id))].join('+'),
    journal: ev.filter((e) => e.type === 'journal_opened').length,
    exports: `${ev.filter((e) => e.type === 'journal_export_completed').length}/${ev.filter((e) => e.type === 'journal_export_attempted').length}`,
    shares: ev.filter((e) => e.type === 'share_result').map((e) => `${e.method}:${e.result}`).join(' '),
    errors: ev.filter((e) => e.type === 'error').map((e) => e.code).join(' '),
    revisit: ev.some((e) => e.type === 'revisit'),
  });
}
const sec = (ms) => (ms === null ? '—' : `${(ms / 1000).toFixed(0)}s`);
console.log('file\tworld\tfirst action\tfirst story done\tstarted\tjournal\texports ok/tried\tshares\terrors\trevisit\tbuild');
for (const s of sessions) {
  console.log([s.file, s.world, `${sec(s.firstMs)} ${s.firstWhat}`, `${sec(s.storyMs)} ${s.story}`, s.started || '—', s.journal, s.exports, s.shares || '—', s.errors || '—', s.revisit ? 'yes' : 'no', s.build].join('\t'));
}
const rate = (num, den) => `${num}/${den}${den ? ` (${Math.round((100 * num) / den)}%)` : ''}`;
for (const w of ['edo', 'china']) {
  const g = sessions.filter((s) => s.world === w && !s.revisit);
  if (!g.length) continue;
  const in30 = g.filter((s) => s.firstMs !== null && s.firstMs <= 30_000).length;
  const in10m = g.filter((s) => s.storyMs !== null && s.storyMs <= 600_000).length;
  console.log(`\n[${w}] first-time sessions: ${g.length}`);
  console.log(`  first action within 30 s (target ≥80%): ${rate(in30, g.length)}`);
  console.log(`  a story completed within 10 min (target ≥70%; check the sheet for hints given): ${rate(in10m, g.length)}`);
  if (g.some((s) => s.dropped)) console.log('  note: some records dropped events (buffer full)');
  if (new Set(g.map((s) => s.build)).size > 1) console.log('  note: sessions come from different builds; do not pool them blindly');
}
console.log('\nSmall samples are not proof (spec): report counts, not just percentages.');
