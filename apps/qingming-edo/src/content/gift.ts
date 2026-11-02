// 贈る画 (roadmap #158 1B; owner: 画纸像图片便签，可送朋友，文案文艺/哲理/安抚/陪伴).
// A page sent to a friend carries a word, never the player's progress, counts or money.
// Original lines, written for this work. China keeps its own library in Chinese.

export interface GiftKind {
  id: 'shimijimi' | 'kangaeru' | 'hotto' | 'soba';
  label: string;
  lines: string[];
}

export const GIFT_KINDS: GiftKind[] = [
  {
    id: 'shimijimi',
    label: 'しみじみ',
    lines: ['風がめくった朝の紙に、あなたを思い出しました。', '同じ通りを、違う時刻に歩いている気がします。', '暖簾の向こうの春を、少し分けて送ります。', '遠い町の朝ですが、光はきっと同じです。'],
  },
  {
    id: 'kangaeru',
    label: '考える',
    lines: ['急がない手つきほど、長く残るのかもしれません。', '誰かの小さな手助けで、町は今日も回っています。', '見ようとした分だけ、景色は細かくなります。', '変わらない道具にも、毎朝ちがう一日があります。'],
  },
  {
    id: 'hotto',
    label: 'ほっとする',
    lines: ['今日はここまでで、じゅうぶんです。', '風の強い日も、紙はちゃんと落ち着きました。', '一休みしても、町はちゃんと待っていてくれます。', 'うまくいかない朝も、お茶はあたたかいままです。'],
  },
  {
    id: 'soba',
    label: 'そばにいる',
    lines: ['離れていても、同じ空の下を歩いています。', 'この一枚を、あなたの机の端に置いてください。', '次は一緒に、この橋を渡りましょう。', 'ふと思い出したので、町の一頁を送ります。'],
  },
];

export const GIFT_LINES: readonly string[] = GIFT_KINDS.flatMap((k) => k.lines);

/** At most two lines of `max` characters, broken after a 、 where one is; a closing 。 may hang one over. */
export function wrapNote(text: string, max = 22): string[] {
  const chars = [...text];
  if (chars.length <= max || (chars.length === max + 1 && /[。、」]/.test(chars[max]))) return [text];
  const head = chars.slice(0, max);
  const comma = head.lastIndexOf('、');
  const cut = comma >= 3 ? comma + 1 : max;
  return [chars.slice(0, cut).join(''), chars.slice(cut).join('')];
}
