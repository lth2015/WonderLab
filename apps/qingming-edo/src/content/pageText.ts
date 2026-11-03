import { STORIES } from './stories';
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
  ...Object.assign({}, ...STORIES.map((s) => s.place)),
};
/** 宗吉's word on a page, by its composition (or, for 一頁目, its subject). */
export const COMMENT_BY_COMPOSITION: Record<string, string> = {
  'dougu-deliver': '渡した手と、受け取った手。その間にあるものが描けている。',
  'dougu-entrust': '届けた者は描かれていない。だが、託した人の思いは残っている。',
  'tenugui-return': '探していたのは布ではなかったな。布にしみた、人の朝だ。',
  ...Object.assign({}, ...STORIES.map((s) => s.comment)),
};
export const RECALL_NOTE: Record<string, string> = {
  kaze: '別のものを描けば、もう一枚の頁が残ります。',
  dougu: 'もう一つの届け方を選べば、別の朝の頁が残ります。',
  tenugui: 'あの朝のことを、もう一度たどります。',
  ...Object.fromEntries(STORIES.map((s) => [s.quest.id, s.recallNote])),
};
