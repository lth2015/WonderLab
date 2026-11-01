// 難語 (spec §8: 難語は押すと説明できる). Words a reader today may not know,
// each with a short plain explanation. PROVISIONAL wording by Claude; Codex,
// who owns the world and its sources, is finalising the list and the notes.
// A note never claims more than it knows; game-world facts say so.

export interface GlossEntry {
  term: string;
  reading: string;
  note: string;
}

export const GLOSSARY: GlossEntry[] = [
  { term: '番頭', reading: 'ばんとう', note: '店の奉公人をまとめ、商いを任された人。' },
  { term: '文鎮', reading: 'ぶんちん', note: '紙が動かないように、上に置く重し。' },
  { term: '振売り', reading: 'ふりうり', note: '品を担いで町を歩き、声をかけて売る商い。' },
  { term: '天秤棒', reading: 'てんびんぼう', note: '両端に荷を下げ、肩で担ぐ長い棒。' },
  { term: '暖簾', reading: 'のれん', note: '店先にかける布。店の顔でもある。' },
  { term: '絵巻', reading: 'えまき', note: '横に長い紙に、場面を続けて描いた絵。' },
  { term: '団子', reading: 'だんご', note: '米の粉を丸めて蒸した菓子。' },
  { term: '煎餅', reading: 'せんべい', note: '米の生地を焼いた、かための菓子。' },
  { term: 'ご隠居', reading: 'ごいんきょ', note: '家の仕事を譲り、ゆったり暮らす年配の人。' },
  { term: '砥石', reading: 'といし', note: '刃物を研ぐための石。' },
  { term: '手拭い', reading: 'てぬぐい', note: '汗をふいたり頭に巻いたりする、木綿の布。' },
  { term: '文', reading: 'もん', note: 'この町で使うお金の単位（遊びの中の値段）。' },
];

/** The terms in a line, longest first so 「天秤棒」 wins over shorter overlaps. */
const ORDERED = [...GLOSSARY].sort((a, b) => b.term.length - a.term.length);

/**
 * Splits a line into plain text and glossary terms. Each term is marked once per
 * line (its first appearance), so a line is not covered in underlines. 「文」 is
 * only marked when a number comes before it (十二文), not in 「文鎮」 or other words.
 */
export function splitGlossed(text: string): (string | GlossEntry)[] {
  const out: (string | GlossEntry)[] = [];
  const used = new Set<string>();
  let rest = text;
  while (rest) {
    let best: { i: number; e: GlossEntry } | null = null;
    for (const e of ORDERED) {
      if (used.has(e.term)) continue;
      let i = rest.indexOf(e.term);
      while (i >= 0 && e.term === '文' && !/[0-9一二三四五六七八九十百千]/.test(rest[i - 1] ?? '')) i = rest.indexOf(e.term, i + 1);
      if (i >= 0 && (!best || i < best.i || (i === best.i && e.term.length > best.e.term.length))) best = { i, e };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.i > 0) out.push(rest.slice(0, best.i));
    out.push(best.e);
    used.add(best.e.term);
    rest = rest.slice(best.i + best.e.term.length);
  }
  return out;
}
