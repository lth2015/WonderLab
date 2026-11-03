// 絵巻帳の頁の言葉 (spec §6, §10): the place line, 宗吉's word and the recall note for
// each story page. Content, not UI: a new story adds its lines here, and
// engine/engine.test.ts checks every page a story can leave has them.

export const COMMENT: Record<string, string> = {
  hands: '手は嘘をつかん。紙を揃える指に、あの男の朝が出ている。',
  shopfront: '店先は町の顔だ。紙が静まった今の店を、よく留めた。',
  street: '人は止まらん。その流れの中で、紙は一枚も飛ばなかった。それでいい。',
};
export const PLACE: Record<string, string> = {
  'p01-kaze': '日本橋北詰・朝　青葉屋の店先',
  'p01-kaze-b': '日本橋北詰・朝　青葉屋の店先',
  'dougu-deliver': '日本橋・朝　米屋の前',
  'dougu-entrust': '日本橋・朝　くれ竹の店先',
  'tenugui-return': '日本橋・朝　茶店「喜の字」の前',
  'kashi-now': '日本橋・朝　向こう岸の河岸',
  'kashi-watch': '日本橋・朝　河岸の樽の陰',
  'fumi-send': '日本橋・朝　米屋の前の往来',
  'fumi-rewrite': '日本橋・朝　米屋の前の往来',
  'yube-tell': '日本橋・夕　橋のたもとの石灯籠',
  'yube-watch': '日本橋・夕　茶店「喜の字」の縁台',
  'ai-vat': '日本橋・朝　紺屋の藍甕',
  'ai-cloth': '日本橋・朝　紺屋の干し場',
  'hashi-with': '日本橋・昼　橋のたもとの空き地',
  'hashi-side': '日本橋・昼　橋のたもとの空き地',
  'neko-bench': '日本橋　茶店「喜の字」の前',
  'neko-boat': '日本橋　堀の河岸の石段',
};
/** 宗吉's word on a page, by its composition (or, for 一頁目, its subject). */
export const COMMENT_BY_COMPOSITION: Record<string, string> = {
  'dougu-deliver': '渡した手と、受け取った手。その間にあるものが描けている。',
  'dougu-entrust': '届けた者は描かれていない。だが、託した人の思いは残っている。',
  'tenugui-return': '探していたのは布ではなかったな。布にしみた、人の朝だ。',
  'kashi-now': '見えない目で、声だけで孫を見つける。その顔を、よく描いた。',
  'kashi-watch': '急がずに隣で見ていたな。待つことも、手助けのうちだ。',
  'fumi-send': '拾った文を、読まずに返した。その手の行儀が、絵に出ている。',
  'fumi-rewrite': '書き直す時間をやったな。人を急かさないのも、町の作法だ。',
  'yube-tell': '灯を点けた手で、点けられなかった人を訪ねた。そこまで描けている。',
  'yube-watch': '自分の点けた灯を、ゆっくり眺めたな。夕方の色が、よく出ている。',
  'ai-vat': '甕の底の藍は、何度も浸けた時間の色だ。よく見たな。',
  'ai-cloth': '濃い布から薄い布へ、藍の移り変わりを捕まえた。朝の光だからこそだ。',
  'hashi-with': '描く者の師まで描いたか。……これで、一枚に町の顔がそろった。',
  'hashi-side': '皆の顔が、描くお前のほうを向いている。この町で過ごした時間が、そこに出ている。',
  'neko-bench': '眠る猫ほど、描くのは難しい。寝息のやわらかさが出ている。',
  'neko-boat': '猫が見ていたものを、お前も並んで見たな。舟の揺れまで描けている。',
};
export const RECALL_NOTE: Record<string, string> = {
  kaze: '別のものを描けば、もう一枚の頁が残ります。',
  dougu: 'もう一つの届け方を選べば、別の朝の頁が残ります。',
  tenugui: 'あの朝のことを、もう一度たどります。',
  kashi: 'もう一つの帰り方を選べば、別の頁が残ります。',
  fumi: 'もう一つの言葉を選べば、別の頁が残ります。',
  yube: 'もう一つの宵の過ごし方を選べば、別の頁が残ります。',
  ai: 'もう一つの藍を描けば、別の頁が残ります。',
  hashi: 'もう一つの描き方を選べば、別の一枚が残ります。',
  neko: 'もう一つの場面を描けば、別の頁が残ります。',
};
