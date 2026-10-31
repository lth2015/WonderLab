import type { Condition, Effect } from '../contract';
import { questById, type Subject } from './world';

// 台本 (spec §8, §12). Readable modern Japanese with a light Edo touch; each
// person has their own voice rather than one loud Edo dialect for everyone.
// Five states per person: 初回、依頼中、完了後、再会、断られた時.

export type Speaker = string; // a character id, or 'narration'

export interface Line { by: Speaker; text: string }
export interface Choice {
  label: string;
  next?: string;
  effects?: Effect[];
  /** Opens the sketch for this subject (spec §9 一頁目). */
  sketch?: Subject;
}
export interface DialogueNode {
  lines: Line[];
  /** Applied once when the node opens. */
  effects?: Effect[];
  choices?: Choice[];
  next?: string;
}

const PRESS: Effect[] = [
  { type: 'setFlag', flag: 'paper_pressed' },
  { type: 'questState', quest: 'kaze', state: 'active' },
];

const SKETCH_CHOICES: Choice[] = [
  { label: '働く手を描く', sketch: 'hands' },
  { label: '店先を描く', sketch: 'shopfront' },
  { label: '通りの往来を描く', sketch: 'street' },
];

export const NODES: Record<string, DialogueNode> = {
  // ---------------------------------------------------------------- 清太
  'seita.first': {
    lines: [
      { by: 'seita', text: 'わっ、すみません！ 今朝漉き上がったばかりの紙が、風でめくれちまって……。' },
      { by: 'seita', text: '手がもう一本あればいいんですが。' },
    ],
    effects: [{ type: 'questState', quest: 'kaze', state: 'discovered' }],
    choices: [
      { label: '文鎮で押さえる', next: 'kaze.pressed' },
      { label: '少し様子を見る', next: 'seita.declined' },
    ],
  },
  'seita.declined': {
    lines: [{ by: 'seita', text: 'へい、どうにか……あっ、また！ いえ、お気になさらず。' }],
  },
  'kaze.pressed': {
    effects: PRESS,
    lines: [
      { by: 'narration', text: '店先の文鎮を紙の上に置くと、めくれていた紙がぴたりと落ち着いた。' },
      { by: 'seita', text: '助かりました！ 一枚でも飛ばしたら、番頭さんに顔向けできないところでした。' },
      { by: 'sokichi', text: '……いい顔をするな、あの男。描いておけ。何を描く。' },
    ],
    choices: SKETCH_CHOICES,
  },
  'seita.waiting': {
    lines: [{ by: 'seita', text: '紙はもう大丈夫です。……あれ、お師匠さんが何か言いたそうですよ。' }],
    next: 'sokichi.ask',
  },
  'seita.done': {
    lines: [{ by: 'seita', text: 'さっきはどうも。文鎮、ちゃんと店の真ん中に置いときました。' }],
  },
  'seita.again': {
    lines: [{ by: 'seita', text: 'おや、また来てくださった。今日は風もおとなしくて、紙も落ち着いてます。' }],
  },

  // ---------------------------------------------------------------- 宗吉
  'sokichi.first': {
    lines: [{ by: 'sokichi', text: '気になるものがあれば、まず見ろ。描くのはそれからだ。' }],
  },
  'sokichi.ask': {
    lines: [{ by: 'sokichi', text: '紙屋の店先、まだ目に残っているだろう。何を描く。' }],
    choices: SKETCH_CHOICES,
  },
  'kaze.after.hands': {
    lines: [{ by: 'sokichi', text: '手は嘘をつかん。紙を揃える指に、あの男の朝が出ている。' }],
    next: 'kaze.reward',
  },
  'kaze.after.shopfront': {
    lines: [{ by: 'sokichi', text: '店先は町の顔だ。紙が静まった今の店を、よく留めた。' }],
    next: 'kaze.reward',
  },
  'kaze.after.street': {
    lines: [{ by: 'sokichi', text: '人は止まらん。その流れの中で、紙は一枚も飛ばなかった。それでいい。' }],
    next: 'kaze.reward',
  },
  'kaze.reward': {
    effects: questById.get('kaze')!.completionEffects,
    lines: [
      { by: 'seita', text: 'これ、少ないですが番頭さんからです。紙を守ってくださったお礼に。' },
      { by: 'narration', text: '十二文を受け取った。絵巻帳に、最初の一頁が残った。' },
    ],
  },
  'sokichi.done': {
    lines: [{ by: 'sokichi', text: '一頁目だな。絵巻帳を開いて、ときどき見返せ。描いた時には見えなかったものが見える。' }],
  },

  // ---------------------------------------------------------------- まだ物語の前の人たち
  // Their stories (二頁目・三頁目) come next; until then they greet and carry on.
  'okon.first': {
    lines: [{ by: 'okon', text: 'いらっしゃい。……おや、絵師さんのお弟子さん？ ちょうど道具の手入れが終わったところでね。持ち主に返す前に、少し眺めていくかい。' }],
  },
  'kisuke.first': {
    lines: [{ by: 'kisuke', text: 'おはようさん。朝のうちは常連さんがぽつぽつでね。誰がいつ来るか、だいたい顔でわかるもんだよ。' }],
  },
  'kinji.first': {
    lines: [{ by: 'kinji', text: 'おっと、ごめんよ。朝の商いの帰りでね。この天秤棒、親父の代からの相棒なんだ。' }],
  },
  'oharu.first': {
    lines: [{ by: 'oharu', text: 'あの、このあたりで藍色の手拭いを……いえ、急ぎじゃないんです。お使いの途中なので、また。' }],
  },
};

/** Which node a person opens with: the first rule that holds (spec §8 五状態). */
export const ENTRIES: Record<string, { when?: Condition; node: string }[]> = {
  seita: [
    { when: { all: [{ quest: 'kaze', is: 'complete' }, { flag: 'seita_seen_done' }] }, node: 'seita.again' },
    { when: { quest: 'kaze', is: 'complete' }, node: 'seita.done' },
    // the page is made but the thanks was closed early: give it now, once
    { when: { flag: 'kaze_page' }, node: 'kaze.reward' },
    { when: { flag: 'paper_pressed' }, node: 'seita.waiting' },
    { node: 'seita.first' },
  ],
  sokichi: [
    { when: { quest: 'kaze', is: 'complete' }, node: 'sokichi.done' },
    { when: { flag: 'kaze_page' }, node: 'kaze.reward' },
    { when: { flag: 'paper_pressed' }, node: 'sokichi.ask' },
    { node: 'sokichi.first' },
  ],
  okon: [{ node: 'okon.first' }],
  kisuke: [{ node: 'kisuke.first' }],
  kinji: [{ node: 'kinji.first' }],
  oharu: [{ node: 'oharu.first' }],
  // the papers themselves: one tap helps (spec §6 10〜30秒)
  papers: [{ node: 'kaze.pressed' }],
};

/** Effects applied when a node is closed after being read (e.g. 再会 markers). */
export const ON_CLOSE: Record<string, Effect[]> = {
  'seita.done': [{ type: 'setFlag', flag: 'seita_seen_done' }],
};
