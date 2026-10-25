// Which builds a set of kept records came from (docs/验证路线图.md §2). Each
// event and visit carries the build that recorded it; an export lists them
// all, so data from before and after a site update is never pooled under
// the build that happens to do the exporting.

export interface BuildSpan {
  experiment: string;
  sha: string;
  events: number;
  visits: number;
  /** First and last record, ms since the epoch. */
  from: number;
  to: number;
}

interface Stamped {
  sha: string;
  exp: string;
}

export function buildSpans(events: (Stamped & { t: number })[], visits: (Stamped & { at: number })[]): BuildSpan[] {
  const spans = new Map<string, BuildSpan>();
  const add = (r: Stamped, at: number, kind: 'events' | 'visits') => {
    const key = `${r.exp}@${r.sha}`;
    const s = spans.get(key) ?? { experiment: r.exp, sha: r.sha, events: 0, visits: 0, from: at, to: at };
    s[kind] += 1;
    s.from = Math.min(s.from, at);
    s.to = Math.max(s.to, at);
    spans.set(key, s);
  };
  for (const e of events) add(e, e.t, 'events');
  for (const v of visits) add(v, v.at, 'visits');
  return [...spans.values()].sort((a, b) => a.from - b.from);
}
