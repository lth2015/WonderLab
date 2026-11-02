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
  { term: '番頭', reading: 'ばんとう', note: '店の仕事や、そこで働く人を取りまとめる人。' },
  { term: '文鎮', reading: 'ぶんちん', note: '紙が風で動かないように、上に置く重し。' },
  { term: '振売り', reading: 'ふりうり', note: '品物を持って町を歩き、売って回る人や商い。' },
  { term: '天秤棒', reading: 'てんびんぼう', note: '両端に荷を下げ、肩に担いで運ぶための棒。' },
  { term: '暖簾', reading: 'のれん', note: '店の入口などにつるす、切れ目のある布。' },
  { term: '絵巻', reading: 'えまき', note: '絵や文を横につなぎ、巻いて収めるもの。' },
  { term: '団子', reading: 'だんご', note: '米の粉などを丸めて作る菓子。' },
  { term: '煎餅', reading: 'せんべい', note: '穀物の粉などを薄くのばして焼く菓子。' },
  { term: 'ご隠居', reading: 'ごいんきょ', note: '家業などを後の人に任せ、一線を退いた人。' },
  { term: '砥石', reading: 'といし', note: '刃物の刃を整え、切れ味を戻すための石。' },
  { term: '手拭い', reading: 'てぬぐい', note: '汗をぬぐうなどに使う、細長い布。' },
  { term: '文', reading: 'もん', note: '江戸のお金の単位。この町の金額は遊びの調整値。' },
  { term: '紺屋', reading: 'こうや', note: '藍などで布を染める仕事や、その店。' },
  { term: '藍甕', reading: 'あいがめ', note: '藍染めに使う液を入れておく、大きなかめ。' },
  { term: '茶店', reading: 'ちゃみせ', note: '茶や菓子を出し、ひと休みできる店。' },
  { term: 'お使い', reading: 'おつかい', note: '頼まれた品物や言付けを届けること。' },
  { term: '河岸', reading: 'かし', note: '川沿いで舟を着け、荷を上げ下ろしする場所。' },
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
