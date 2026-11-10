import type { Condition, Effect } from '../contract';
import { AMBIENT, PAGE_SLOTS, questById, SKETCHES, sketchPageId } from './world';

// 台本 (spec §8, §12). Readable modern Japanese with a light Edo touch; each
// person has their own voice rather than one loud Edo dialect for everyone.
// Five states per person: 初回、依頼中、完了後、再会、断られた時.

export type { Speaker, Line, Choice, DialogueNode } from './types';
import { STORIES } from './stories';
import { RUMOR_RANK, RUMORS } from './rumors';
import { LOST, LOST_ALL_BACK, LOST_OPEN } from './lost';
import { TEA_PRICE } from './shop';
import { PASSERS, passerFlag } from './passers';
import type { Rule } from './stories/types';
import type { Line, Choice, DialogueNode } from './types';

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
      { by: 'seita', text: 'これ、少ないですが番頭さんからです。紙を守ってくださったお礼に。', reward: true },
      { by: 'narration', text: '十二文を受け取った。絵巻帳に、最初の一頁が残った。', reward: true },
    ],
  },
  // 絵巻帳が一冊に (all twelve pages): the free experience comes to rest, the town goes on
  'sokichi.full': {
    effects: [{ type: 'setFlag', flag: 'book_full' }],
    lines: [
      { by: 'sokichi', text: 'ほう……。白い頁が、もう一枚も残っておらんな。' },
      { by: 'sokichi', text: '紙屋の店先から、町はずれの川端まで。お前の目で歩いた日本橋が、一冊になった。' },
      { by: 'sokichi', text: '絵巻は、描き終えたところで終わりではない。明日になれば、町はまた違う顔を見せる。……また歩け。' },
      { by: 'narration', text: '絵巻帳が、一冊になった。' },
    ],
  },
  'sokichi.full.again': {
    lines: [{ by: 'sokichi', text: 'また来たか。町は変わらんようで、毎朝少しずつ違う。見返すたびに、頁も違って見えるはずだ。' }],
  },
  'sokichi.done': {
    lines: [
      { by: 'sokichi', text: '一頁目だな。絵巻帳を開いて、ときどき見返せ。描いた時には見えなかったものが見える。' },
      { by: 'sokichi', text: '町には、まだ描かれていないものがいくらでもある。気になる景色があれば、足を止めて写してみろ。' },
    ],
  },

  // ---------------------------------------------------------------- まだ物語の前の人たち
  // Greetings before their stories begin.
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

  // ---------------------------------------------------------------- 二頁目：いつもの道具
  'okon.ask': {
    effects: [{ type: 'questState', quest: 'dougu', state: 'discovered' }],
    lines: [
      { by: 'okon', text: 'あら、さっき青葉屋さんの紙を押さえてたの、見てたよ。手際がいいねえ。' },
      { by: 'okon', text: 'ちょいと頼まれてくれないかい。振売りの金次さんから預かってた道具の手入れが済んでね。返す前に包みたいんだけど、品と包みの印を合わせなきゃならないの。' },
    ],
    choices: [
      { label: '包むのを手伝う', game: 'wrap', next: 'okon.wrapped' },
      { label: '今は町を見て回りたい', next: 'okon.declined' },
    ],
  },
  'okon.declined': {
    effects: [{ type: 'setFlag', flag: 'dougu_declined' }],
    lines: [{ by: 'okon', text: 'そうかい。気が向いたら、また声をかけておくれ。急ぎの品じゃないからね。' }],
  },
  'okon.ask.again': {
    lines: [{ by: 'okon', text: 'おや、戻ってきてくれたのかい。金次さんの道具、包むのを手伝ってくれるかい。' }],
    choices: [
      { label: '包むのを手伝う', game: 'wrap', next: 'okon.wrapped' },
      { label: 'もう少し町を見てくる', next: 'okon.declined' },
    ],
  },
  'okon.wrapped': {
    effects: [
      { type: 'setFlag', flag: 'dougu_wrapped' },
      { type: 'questState', quest: 'dougu', state: 'active' },
    ],
    lines: [
      { by: 'narration', text: '三つの品が、それぞれの印の布にきちんと収まった。' },
      { by: 'okon', text: '上出来だよ。弁当箱に箸箱、それに砥石。どれも金次さんが毎日使うものさ。' },
      { by: 'okon', text: '金次さんは今ごろ、米屋の前でひと休みしてるはずだよ。届けてくれるかい。それとも、使いのお春ちゃんに頼もうか。' },
    ],
    choices: [
      { label: '自分で届ける', next: 'okon.carry' },
      { label: 'お春さんに託す', next: 'okon.entrust' },
    ],
  },
  'okon.choose': {
    lines: [{ by: 'okon', text: '包みはできてるよ。自分で届けるかい、それともお春ちゃんに頼むかい。' }],
    choices: [
      { label: '自分で届ける', next: 'okon.carry' },
      { label: 'お春さんに託す', next: 'okon.entrust' },
    ],
  },
  'okon.carry': {
    effects: [{ type: 'setFlag', flag: 'dougu_carry' }],
    recallNext: 'kinji.receive',
    lines: [
      { by: 'okon', text: '頼んだよ。米屋の前で天秤棒を下ろしてるのが金次さんさ。' },
      { by: 'narration', text: '包みを受け取った。通りを左へ、米屋のほうへ。' },
    ],
  },
  'okon.carrying': {
    lines: [{ by: 'okon', text: '金次さんは米屋の前だよ。包み、落とさないようにね。' }],
  },
  'okon.entrust': {
    effects: [{ type: 'setFlag', flag: 'dougu_entrusted' }, ...questById.get('dougu')!.completionEffects],
    page: { pageId: 'p02-dougu', compositionId: 'dougu-entrust' },
    lines: [
      { by: 'narration', text: 'お紺が手を振ると、お春が駆けてきた。包みを大事そうに抱えて、米屋のほうへ走っていく。' },
      { by: 'okon', text: '……あの弁当箱はね、金次さんのお父っつぁんが、うちで最初に買ってくれた品なんだよ。' },
      { by: 'okon', text: 'お父っつぁんが亡くなってからも、金次さんは毎年、塗り直しに持ってくる。だから、いい加減な包みでは返せなくてね。' },
      { by: 'okon', text: 'ありがとう。少しだけど、手間賃だよ。', reward: true },
      { by: 'narration', text: '二十四文を受け取った。絵巻帳に、二頁目が残った。', reward: true },
    ],
  },
  'kinji.receive': {
    effects: [
      { type: 'setFlag', flag: 'dougu_by_hand' },
      { type: 'familiarity', characterId: 'kinji', eventId: 'dougu' },
      ...questById.get('dougu')!.completionEffects,
    ],
    page: { pageId: 'p02-dougu', compositionId: 'dougu-deliver' },
    lines: [
      { by: 'kinji', text: 'ん？ その包み……お紺さんとこのか！' },
      { by: 'narration', text: '包みをほどくと、塗り直された弁当箱が朝の光をはね返した。' },
      { by: 'kinji', text: '親父の代からの弁当箱だ。剥げてたところが、すっかりきれいになってら。' },
      { by: 'kinji', text: 'よし、今日の昼はこいつで食うぞ。わざわざありがとよ。' },
      { by: 'kinji', text: 'これ、取っといてくんな。', reward: true },
      { by: 'narration', text: '二十四文を受け取った。絵巻帳に、二頁目が残った。', reward: true },
    ],
  },
  'okon.done': {
    lines: [{ by: 'okon', text: '金次さん、喜んでたかい。……顔を見なくても、わかる気がするよ。' }],
  },
  'okon.again': {
    lines: [{ by: 'okon', text: 'また来たのかい。道具ってのは、使う人の手になじんでこそだよ。' }],
  },
  'kinji.done': {
    lines: [{ by: 'kinji', text: 'お、さっきの！ 弁当箱、さっそく使わせてもらったよ。飯がうまくてね。' }],
  },
  'kinji.done.entrust': {
    lines: [{ by: 'kinji', text: 'お春ちゃんが道具を届けてくれたよ。お紺さんにも、あんたにも、よろしくな。' }],
  },
  'oharu.after': {
    effects: [{ type: 'setFlag', flag: 'oharu_after_seen' }],
    lines: [{ by: 'oharu', text: '金次さんに、ちゃんとお届けしました。……手拭いのほうは、まだ見つからなくて。' }],
    next: 'oharu.ask',
  },

  // ---------------------------------------------------------------- 三頁目：あの人の手拭い
  'oharu.ask': {
    effects: [{ type: 'questState', quest: 'tenugui', state: 'discovered' }],
    lines: [
      { by: 'oharu', text: 'あの……絵師のお弟子さん、ですよね。少しだけ、聞いてもらえますか。' },
      { by: 'oharu', text: 'お使い先のご隠居さまが、大事にしている藍の手拭いをなくされて。今朝、喜の字さんで一休みされて、それきりなんです。' },
    ],
    choices: [
      { label: '一緒に探す', next: 'oharu.accepted' },
      { label: '今は手が離せない', next: 'oharu.declined' },
    ],
  },
  'oharu.declined': {
    effects: [{ type: 'setFlag', flag: 'tenugui_declined' }],
    lines: [{ by: 'oharu', text: 'いえ、いいんです。もう少し自分で探してみます。' }],
  },
  'oharu.ask.again': {
    lines: [{ by: 'oharu', text: 'まだ見つからなくて……。やっぱり、手伝ってもらえませんか。' }],
    choices: [
      { label: '一緒に探す', next: 'oharu.accepted' },
      { label: 'もう少し後で', next: 'oharu.declined' },
    ],
  },
  'oharu.accepted': {
    effects: [
      { type: 'setFlag', flag: 'tenugui_asked' },
      { type: 'questState', quest: 'tenugui', state: 'active' },
    ],
    lines: [
      { by: 'oharu', text: 'ありがとうございます！ 茶店の喜助さんなら、何か知っているかもしれません。' },
      { by: 'narration', text: '茶店「喜の字」へ。喜助に声をかけてみよう。' },
    ],
    recallNext: 'kisuke.lost',
  },
  'oharu.waiting': {
    lines: [{ by: 'oharu', text: '喜助さんのところ、どうでした？ わたし、もう一度このあたりを見てきます。' }],
  },
  'kisuke.lost': {
    lines: [
      { by: 'kisuke', text: '手拭いの忘れ物かい。それがね、今朝は二本あるんだよ。どっちも藍でね。' },
      { by: 'kisuke', text: 'どっちがご隠居のか……朝の常連さんなら見てたかもしれない。ちょうど来たところだ、茶を運ぶのを手伝ってくれるかい。' },
    ],
    choices: [
      { label: 'お茶を運ぶ', game: 'tea', next: 'kisuke.served' },
      { label: 'あとにする', next: 'kisuke.later' },
    ],
  },
  'kisuke.later': {
    lines: [{ by: 'kisuke', text: 'あいよ。手拭いは逃げやしないから、気が向いたらおいで。' }],
  },
  'kisuke.served': {
    effects: [{ type: 'setFlag', flag: 'tenugui_clue' }],
    lines: [
      { by: 'narration', text: '大工は団子を頬ばり、女師匠は煎餅をゆっくり割った。' },
      { by: 'narration', text: '女師匠「そういえば、今朝ここにいたご隠居さん。汗を拭いた手拭いを、いつもみたいに固く結んで腰に下げてたわね。波の柄だったかしら。」' },
      { by: 'kisuke', text: 'ありがてえ、いい話が聞けた。さあ、二本の手拭い、見比べてみな。' },
    ],
    choices: [{ label: '手拭いを見比べる', game: 'tenugui', next: 'kisuke.picked' }],
  },
  'kisuke.compare': {
    lines: [{ by: 'kisuke', text: '二本とも、ここに置いてあるよ。もう一度見比べてみるかい。' }],
    choices: [
      { label: '手拭いを見比べる', game: 'tenugui', next: 'kisuke.picked' },
      { label: 'あとにする', next: 'kisuke.later' },
    ],
  },
  'kisuke.picked': {
    effects: [{ type: 'setFlag', flag: 'tenugui_found' }],
    lines: [
      { by: 'kisuke', text: 'うん、こっちだ。固い結び目、ご隠居の癖だよ。お春ちゃんに届けてやっておくれ。' },
      { by: 'narration', text: '波の柄の手拭いを預かった。' },
    ],
    recallNext: 'oharu.return',
  },
  'kisuke.waiting3': {
    lines: [{ by: 'kisuke', text: 'お春ちゃんなら、さっきまでそこの通りにいたよ。' }],
  },
  'oharu.return': {
    effects: questById.get('tenugui')!.completionEffects,
    page: { pageId: 'p03-tenugui', compositionId: 'tenugui-return' },
    lines: [
      { by: 'oharu', text: 'これです！ この波の柄……ああ、よかった。' },
      { by: 'oharu', text: 'これ、ご隠居さまの亡くなったおかみさんが、はじめて自分で染めた手拭いなんです。' },
      { by: 'oharu', text: '色はすっかり褪せたけど、毎朝それで汗を拭くのが、おかみさんと散歩してる気分なんだって。……わたし、走って届けてきます。' },
      { by: 'narration', text: '十八文を受け取った。絵巻帳に、三頁目が残った。', reward: true },
    ],
  },
  'oharu.done3': {
    lines: [{ by: 'oharu', text: 'ご隠居さま、手拭いを握ったまま、しばらく黙ってらっしゃいました。……ありがとうございました。' }],
  },
  'kisuke.done3': {
    lines: [{ by: 'kisuke', text: '手拭い、無事に戻ったってね。今度来たら、一杯おごるよ。' }],
  },
};

// the stories in their own files (content/stories), in page order
for (const st of STORIES) Object.assign(NODES, st.nodes);

// 探し物 (content/lost.ts): the owner's word, the find (a note over the street), the giving back
for (const t of LOST) {
  NODES[`lost.${t.id}.hint`] = { effects: [{ type: 'setFlag', flag: `lost_hint_${t.id}` }], lines: t.hint };
  NODES[`lost.${t.id}.find`] = { brief: true, effects: [{ type: 'setFlag', flag: `lost_found_${t.id}` }], lines: [{ by: 'narration', text: t.find }] };
  NODES[`lost.${t.id}.back`] = { effects: [{ type: 'setFlag', flag: `lost_back_${t.id}` }], lines: t.back };
}
NODES['lost.allback'] = { effects: [{ type: 'setFlag', flag: 'lost_allback' }], lines: LOST_ALL_BACK };

// 町のうわさ (content/rumors.ts): each said once
for (const r of RUMORS) NODES[`rumor.${r.id}`] = { effects: [{ type: 'setFlag', flag: `rumor_${r.id}` }], lines: r.lines };

// 町の写生: tapping one of the places offers to draw it, until its page is made
for (const k of SKETCHES) {
  NODES[`sk.${k.id}`] = {
    lines: [
      { by: 'narration', text: AMBIENT[k.spots[0]] },
      { by: 'narration', text: `${k.title}。足を止めて、この景色を写しておこうか。` },
    ],
    choices: [{ label: 'この景色を写す', game: 'trace', trace: k.id, next: `sk.${k.id}.made` }, { label: '眺めるだけにする' }],
  };
  NODES[`sk.${k.id}.made`] = {
    page: { pageId: sketchPageId(k.id), compositionId: `sketch-${k.id}-{tod}` }, // drawn in the time shown
    lines: [{ by: 'narration', text: `しばらく筆を走らせた。絵巻帳に「${k.title}」の頁が残った。` }],
  };
}

// After a story, the person can be talked with a little more (即興のひとこと).
for (const id of ['seita.done', 'seita.again', 'okon.done', 'okon.again', 'kinji.done', 'kinji.done.entrust', 'kisuke.done3', 'oharu.done3', 'sokichi.done', 'sokichi.full', 'sokichi.full.again', ...STORIES.flatMap((st) => st.talk ?? [])]) {
  NODES[id].choices = [{ label: '少し話す', talk: true }];
}
// 買い物 (spec §11): a rest at 喜助's tea house, title slips at 青葉屋 (content/shop.ts)
NODES['kisuke.done3'].choices!.push({ label: `一服する（${TEA_PRICE}文）`, shop: 'tea' });
// after 夕暮れの灯 his evening word is always the lamps: the tea house stays open then too
NODES['kisuke.yube.after'].choices = [{ label: '少し話す', talk: true }, { label: `一服する（${TEA_PRICE}文）`, shop: 'tea' }];
for (const id of ['seita.done', 'seita.again']) NODES[id].choices!.push({ label: '題箋を見る', shop: 'slips' });
// 通りすがりの人と話す (content/passers.ts): a passer-by stops and talks about their work
for (const [id, p] of Object.entries(PASSERS)) {
  const ask: Choice[] = [...p.topics.map((t, i) => ({ label: t.q, next: `pass.${id}.${i}` })), { label: '引き止めてごめんなさい', next: `pass.${id}.bye` }];
  NODES[`pass.${id}`] = { lines: [{ by: 'narration', text: p.stop }, { by: id, text: p.hello }], choices: ask, effects: [{ type: 'setFlag', flag: passerFlag(id) }] };
  // met again: they remember the player
  NODES[`pass.${id}.again`] = { lines: [{ by: 'narration', text: p.stop }, { by: id, text: p.again }], choices: ask };
  p.topics.forEach((t, i) => (NODES[`pass.${id}.${i}`] = { lines: t.a.map((text) => ({ by: id, text })), next: `pass.${id}.more` }));
  NODES[`pass.${id}.more`] = { lines: [{ by: id, text: p.more }], choices: ask };
  NODES[`pass.${id}.bye`] = { lines: [{ by: id, text: p.bye }] };
}

// after 橋のたもと, 宗吉 can look back over the day with the player (ui/Epilogue.tsx)
NODES['sokichi.hashi.after'].choices!.push({ label: '今日の町をふりかえる', epilogue: true });

// 朝・昼・夕で言うことが変わる (owner: 多开发内容; demo feedback 「剧情太少」). A person's
// everyday word after their story has a morning and an evening version; noon is the
// base node. Variants copy the base node (its choices, such as 少し話す) with new lines,
// and are named `${base}@${time}` (engine/story.ts entryFor picks them).
const AT_TIME: Record<string, Partial<Record<'morning' | 'evening', Line>>> = {
  'seita.again': {
    morning: { by: 'seita', text: '朝の紙は湿り気が少なくて、手ざわりがいいんです。今日も一枚ずつ並べてます。' },
    evening: { by: 'seita', text: 'もう店じまいの支度です。今日は一枚も飛ばずにすみました。おかげさまで。' },
  },
  'okon.again': {
    morning: { by: 'okon', text: '朝いちばんは、漆のにおいがいちばん澄んでるんだよ。' },
    evening: { by: 'okon', text: '夕方になると、手入れに持ち込まれる道具が増えるのさ。一日よく働いた道具だからね。' },
  },
  'kinji.done': {
    morning: { by: 'kinji', text: 'これから一回り行ってくるよ。弁当箱は、ちゃんと包んで持ってる。' },
    evening: { by: 'kinji', text: '今日もよく売れた。空の籠は軽いけど、足はくたくただ。' },
  },
  'kinji.done.entrust': {
    morning: { by: 'kinji', text: 'お春ちゃんが届けてくれた包み、今朝あけたよ。いい塗り直しだ。' },
    evening: { by: 'kinji', text: '一日売り歩いて、帰りにこの通りを通ると、なんだかほっとするんだ。' },
  },
  'kisuke.done3': {
    morning: { by: 'kisuke', text: '朝の一番茶だ。湯がやわらかいうちに飲んでいきな。' },
    evening: { by: 'kisuke', text: '夕方の客は長居するんだ。一日の話を、ここに置いていくのさ。' },
  },
  'oharu.done3': {
    morning: { by: 'oharu', text: '朝のお使いは早いほうがいいんです。今日は用事が三つもあって。' },
    evening: { by: 'oharu', text: 'お使いは今日はおしまい。手拭い、ちゃんと首に巻いてますよ。' },
  },
};
for (const st of STORIES) Object.assign(AT_TIME, st.atTime ?? {});
for (const [base, byTime] of Object.entries(AT_TIME)) {
  for (const [t, line] of Object.entries(byTime)) NODES[`${base}@${t}`] = { ...NODES[base], lines: [line!] };
}

/** Where each finished story is replayed from in 回想. */
export const RECALL_START: Record<string, string> = {
  kaze: 'kaze.pressed',
  dougu: 'okon.ask',
  tenugui: 'oharu.ask',
  ...Object.fromEntries(STORIES.map((st) => [st.quest.id, st.recallStart])),
};


/** Which node a person opens with: the first rule that holds (spec §8 五状態). */
const BASE_ENTRIES: Record<string, { rank?: number; when?: Condition; node: string }[]> = {
  seita: [
    { when: { all: [{ quest: 'kaze', is: 'complete' }, { flag: 'seita_seen_done' }] }, node: 'seita.again' },
    { when: { quest: 'kaze', is: 'complete' }, node: 'seita.done' },
    // the page is made but the thanks was closed early: give it now, once
    { when: { flag: 'kaze_page' }, node: 'kaze.reward' },
    { when: { flag: 'paper_pressed' }, node: 'seita.waiting' },
    { node: 'seita.first' },
  ],
  sokichi: [
    { rank: 400, when: { flag: 'book_full' }, node: 'sokichi.full.again' },
    { rank: 410, when: { pagesAtLeast: PAGE_SLOTS }, node: 'sokichi.full' },
    { when: { quest: 'kaze', is: 'complete' }, node: 'sokichi.done' },
    { when: { flag: 'kaze_page' }, node: 'kaze.reward' },
    { when: { flag: 'paper_pressed' }, node: 'sokichi.ask' },
    { node: 'sokichi.first' },
  ],
  okon: [
    { when: { all: [{ quest: 'dougu', is: 'complete' }, { flag: 'okon_seen_done' }] }, node: 'okon.again' },
    { when: { quest: 'dougu', is: 'complete' }, node: 'okon.done' },
    { when: { flag: 'dougu_carry' }, node: 'okon.carrying' },
    { when: { flag: 'dougu_wrapped' }, node: 'okon.choose' },
    { when: { all: [{ quest: 'kaze', is: 'complete' }, { flag: 'dougu_declined' }] }, node: 'okon.ask.again' },
    { when: { quest: 'kaze', is: 'complete' }, node: 'okon.ask' },
    { node: 'okon.first' },
  ],
  kisuke: [
    { when: { quest: 'tenugui', is: 'complete' }, node: 'kisuke.done3' },
    { when: { flag: 'tenugui_found' }, node: 'kisuke.waiting3' },
    { when: { flag: 'tenugui_clue' }, node: 'kisuke.compare' },
    { when: { flag: 'tenugui_asked' }, node: 'kisuke.lost' },
    { node: 'kisuke.first' },
  ],
  kinji: [
    { when: { flag: 'dougu_by_hand' }, node: 'kinji.done' },
    { when: { flag: 'dougu_entrusted' }, node: 'kinji.done.entrust' },
    { when: { flag: 'dougu_carry' }, node: 'kinji.receive' },
    { node: 'kinji.first' },
  ],
  oharu: [
    { when: { quest: 'tenugui', is: 'complete' }, node: 'oharu.done3' },
    { when: { flag: 'tenugui_found' }, node: 'oharu.return' },
    { when: { flag: 'tenugui_asked' }, node: 'oharu.waiting' },
    // after carrying the bundle for お紺, she reports that first, then asks
    { when: { all: [{ flag: 'dougu_entrusted' }, { not: { flag: 'oharu_after_seen' } }] }, node: 'oharu.after' },
    { when: { all: [{ quest: 'kaze', is: 'complete' }, { flag: 'tenugui_declined' }] }, node: 'oharu.ask.again' },
    { when: { quest: 'kaze', is: 'complete' }, node: 'oharu.ask' },
    { node: 'oharu.first' },
  ],

  // the papers themselves: one tap helps (spec §6 10〜30秒)
  papers: [{ node: 'kaze.pressed' }],
};
/**
 * Which node a person opens with: the first rule that holds (spec §8 五状態). Each story's
 * rules are merged in by rank; rules here without a rank come after them, in their order.
 */
export const ENTRIES: Record<string, { when?: Condition; node: string }[]> = (() => {
  const all: Record<string, Rule[]> = {};
  for (const [t, rules] of Object.entries(BASE_ENTRIES)) all[t] = rules.map((r, i) => ({ ...r, rank: r.rank ?? 1000 + i }));
  for (const st of STORIES) for (const [t, rules] of Object.entries(st.entries)) all[t] = [...(all[t] ?? []), ...rules];
  // 探し物: giving a found thing back comes before the rumors; the owner's word about the loss
  // after them, once their own thanks has been read
  LOST.forEach((t, i) => {
    const r = RUMOR_RANK[t.owner] - 0.9 + i / 100;
    all[t.owner] = [
      ...(all[t.owner] ?? []),
      { rank: r, when: { all: [{ flag: `lost_found_${t.id}` }, { not: { flag: `lost_back_${t.id}` } }] }, node: `lost.${t.id}.back` },
      { rank: RUMOR_RANK[t.owner] + 0.5 + i / 100, when: { all: [LOST_OPEN, { quest: t.needs, is: 'complete' }, ...(t.seen ? [{ flag: t.seen }] : []), { not: { flag: `lost_hint_${t.id}` } }, { not: { flag: `lost_found_${t.id}` } }] }, node: `lost.${t.id}.hint` },
    ];
    all[`lost_${t.id}`] = [{ rank: 100, node: `lost.${t.id}.find` }];
  });
  all.sokichi = [...(all.sokichi ?? []), { rank: RUMOR_RANK.sokichi - 0.5, when: { all: [...LOST.map((t) => ({ flag: `lost_back_${t.id}` })), { not: { flag: 'lost_allback' } }] }, node: 'lost.allback' }];
  // うわさ: after every request, before the person's everyday word (content/rumors.ts RUMOR_RANK)
  RUMORS.forEach((r, i) => {
    const when: Condition = { all: [{ quest: r.needs, is: 'complete' }, { quest: r.after, is: 'complete' }, { not: { flag: `rumor_${r.id}` } }] };
    all[r.who] = [...(all[r.who] ?? []), { rank: RUMOR_RANK[r.who] + i / 100, when, node: `rumor.${r.id}` }];
  });
  return Object.fromEntries(Object.entries(all).map(([t, rules]) => [t, [...rules].sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...r }) => r)]));
})();


/** Effects applied when a node is closed after being read (e.g. 再会 markers). */
export const ON_CLOSE: Record<string, Effect[]> = {
  'seita.done': [{ type: 'setFlag', flag: 'seita_seen_done' }],
  'okon.done': [{ type: 'setFlag', flag: 'okon_seen_done' }],
  'kisuke.done3': [{ type: 'setFlag', flag: 'kisuke_seen_done' }],
  'kinji.done': [{ type: 'setFlag', flag: 'kinji_seen_done' }],
  'kinji.done.entrust': [{ type: 'setFlag', flag: 'kinji_seen_done' }],
  'oharu.done3': [{ type: 'setFlag', flag: 'oharu_seen_done' }],
  'kame.done': [{ type: 'setFlag', flag: 'kame_seen_done' }],
};
