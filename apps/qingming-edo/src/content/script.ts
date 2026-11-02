import type { Condition, Effect } from '../contract';
import { AMBIENT, PAGE_SLOTS, questById, SKETCHES, sketchPageId, type Subject } from './world';

// 台本 (spec §8, §12). Readable modern Japanese with a light Edo touch; each
// person has their own voice rather than one loud Edo dialect for everyone.
// Five states per person: 初回、依頼中、完了後、再会、断られた時.

export type Speaker = string; // a character id, or 'narration'

/** `reward`: a line about being paid, left out in 回想 (replays never pay). */
export interface Line { by: Speaker; text: string; reward?: boolean }
export interface Choice {
  label: string;
  next?: string;
  effects?: Effect[];
  /** Opens the sketch for this subject (spec §9 一頁目). */
  sketch?: Subject;
  /** Stays to talk a little (即興のひとこと, ui/Talk.tsx). */
  talk?: boolean;
  /** Opens a short game; on success the dialogue goes on at `next` (spec §10). */
  game?: 'wrap' | 'tea' | 'tenugui';
}
export interface DialogueNode {
  lines: Line[];
  /** Applied once when the node opens. */
  effects?: Effect[];
  choices?: Choice[];
  next?: string;
  /** A journal page this node leaves (made once; spec §9). */
  page?: { pageId: string; compositionId: string };
  /** In 回想, where the scene goes on when the original sends the player walking elsewhere. */
  recallNext?: string;
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

// 四頁目：河岸の朝 (roadmap #158 item 4). Across the bridge, a new place and a new way
// to take part: look for someone in the painting itself. Either ending completes it.
const KASHI_DONE: Effect[] = [{ type: 'setFlag', flag: 'kashi_found' }];
Object.assign(NODES, {
  'omatsu.first': {
    effects: [{ type: 'setFlag', flag: 'met_omatsu' }],
    lines: [
      { by: 'omatsu', text: 'おや、橋を渡ってきたのかい。こっちの河岸は、朝がいちばん忙しくてねえ。' },
      { by: 'omatsu', text: '舟が着くたびに、籠が上がって、声が飛び交う。年寄りには目が回るよ。' },
    ],
  },
  'omatsu.ask': {
    effects: [{ type: 'setFlag', flag: 'met_omatsu' }, { type: 'questState', quest: 'kashi', state: 'discovered' }],
    lines: [
      { by: 'omatsu', text: '亀吉！ 亀吉やい！ ……あら、ごめんなさいね。人違いだ。' },
      { by: 'omatsu', text: '孫の亀吉が、さっきから見えなくてね。この目じゃ、遠くの子の顔がわからないのさ。' },
      { by: 'omatsu', text: '舟が着く朝は、決まってどこかへ潜りこんで荷揚げを眺めてるんだよ。見つけてやってくれるかい。' },
    ],
    choices: [
      { label: '探してみる', next: 'omatsu.search' },
      { label: '今は町を見て回りたい', next: 'omatsu.declined' },
    ],
  },
  'omatsu.declined': {
    effects: [{ type: 'setFlag', flag: 'kashi_declined' }],
    lines: [{ by: 'omatsu', text: 'そうかい。まあ、お腹がすけば戻ってくる子だからね。' }],
  },
  'omatsu.ask.again': {
    lines: [{ by: 'omatsu', text: '亀吉は、まだ戻らなくてねえ。……探してくれるかい。' }],
    choices: [
      { label: '探してみる', next: 'omatsu.search' },
      { label: 'もう少し町を見てくる', next: 'omatsu.declined' },
    ],
  },
  'omatsu.search': {
    effects: [{ type: 'setFlag', flag: 'kashi_search' }, { type: 'questState', quest: 'kashi', state: 'active' }],
    recallNext: 'kame.found',
    lines: [
      { by: 'omatsu', text: '茶色の着物の、八つの男の子だよ。小さいから、物の陰に隠れたら見えやしない。' },
      { by: 'narration', text: '河岸を見渡してみよう。舟のあたり、籠や樽の陰に、小さな姿が隠れているかもしれない。' },
    ],
  },
  'omatsu.searching': {
    lines: [{ by: 'omatsu', text: '舟のほうかねえ、樽のほうかねえ。あの子は、荷揚げが好きでね。' }],
  },
  'kame.found': {
    effects: KASHI_DONE,
    lines: [
      { by: 'kamekichi', text: 'わっ！ ……見つかっちまった。' },
      { by: 'kamekichi', text: '今朝は、大きな舟が着くんだ。荷揚げするとこ、いっぺん近くで見たかったんだよ。' },
      { by: 'narration', text: '向こうの舟から、籠がひとつ、またひとつと岸へ渡されていく。' },
    ],
    choices: [
      { label: 'すぐ連れて帰る', next: 'kame.now' },
      { label: '荷揚げを一緒に見てから帰る', next: 'kame.watch' },
    ],
  },
  'kame.now': {
    effects: [{ type: 'setFlag', flag: 'kashi_now' }, { type: 'familiarity', characterId: 'kamekichi', eventId: 'kashi' }, ...questById.get('kashi')!.completionEffects],
    page: { pageId: 'p04-kashi', compositionId: 'kashi-now' },
    lines: [
      { by: 'narration', text: '亀吉の手を引いて、おまつのところへ戻った。' },
      { by: 'omatsu', text: '亀吉！ ……まったく、心配させて。' },
      { by: 'kamekichi', text: 'ごめんよ、ばあちゃん。' },
      { by: 'omatsu', text: '顔が見えなくてもね、声を聞けば、すぐにわかるんだよ。……ありがとうね。' },
      { by: 'omatsu', text: '少しだけど、取っといておくれ。', reward: true },
      { by: 'narration', text: '二十文を受け取った。絵巻帳に、四頁目が残った。', reward: true },
    ],
  },
  'kame.watch': {
    effects: [{ type: 'setFlag', flag: 'kashi_watched' }, { type: 'familiarity', characterId: 'kamekichi', eventId: 'kashi' }, ...questById.get('kashi')!.completionEffects],
    page: { pageId: 'p04-kashi', compositionId: 'kashi-watch' },
    lines: [
      { by: 'narration', text: '二人で樽の陰にしゃがんで、荷揚げをしばらく眺めた。亀吉は、籠が渡るたびに小さく声を上げた。' },
      { by: 'narration', text: '最後の籠が岸に上がると、亀吉は自分から立ち上がった。二人で、おまつのところへ戻った。' },
      { by: 'omatsu', text: 'おや、二人して。……荷揚げを見てたのかい。' },
      { by: 'omatsu', text: 'この子の父親もね、昔はああして舟から荷を揚げていたんだよ。' },
      { by: 'kamekichi', text: 'おいらも、大きくなったら舟に乗るんだ。' },
      { by: 'omatsu', text: '……ありがとうね。少しだけど、取っといておくれ。', reward: true },
      { by: 'narration', text: '二十文を受け取った。絵巻帳に、四頁目が残った。', reward: true },
    ],
  },
  'omatsu.done': {
    lines: [{ by: 'omatsu', text: '亀吉は、すっかり舟の手伝いのつもりさ。邪魔にならないといいけどねえ。' }],
  },
  'omatsu.done.watch': {
    lines: [{ by: 'omatsu', text: 'あの子、帰ってから荷揚げの話ばかりでね。父親の話も、少ししてやったよ。' }],
  },
  'kame.done': {
    lines: [{ by: 'kamekichi', text: 'また来たのかい！ 次の舟が着いたら、一緒に見ようぜ。' }],
  },
} satisfies Record<string, DialogueNode>);

// 五頁目：母への文. A new way to take part: catch a man walking down the street.
Object.assign(NODES, {
  'fumi.found': {
    lines: [
      { by: 'narration', text: '米屋の前の道に、折りたたんだ文が落ちている。表には「母上様」とだけ書いてある。' },
      { by: 'narration', text: 'さっきそろばんを抱えて通り過ぎた商人のものだろうか。' },
    ],
    choices: [
      { label: '拾って追いかける', next: 'fumi.carry' },
      { label: 'そのままにしておく' },
    ],
  },
  'fumi.carry': {
    effects: [{ type: 'setFlag', flag: 'fumi_carry' }, { type: 'questState', quest: 'fumi', state: 'active' }],
    recallNext: 'ihei.receive',
    lines: [{ by: 'narration', text: '文を拾った。そろばんの包みを抱えた男が、通りをゆっくり歩いていく。追いついて、声をかけよう。' }],
  },
  'ihei.receive': {
    lines: [
      { by: 'ihei', text: 'おや、それは……わたしの文だ。落としたのに気づかなかった。' },
      { by: 'ihei', text: '郷の母に書いたものでね。もう三月も出しそびれている。' },
      { by: 'ihei', text: '書いてはみたが、商いがうまくいかないことまで書いてしまった。心配させるだけかと思うと、どうもね。' },
    ],
    choices: [
      { label: 'そのまま出したほうがいい', next: 'ihei.send' },
      { label: '書き直してから出せばいい', next: 'ihei.rewrite' },
    ],
  },
  'ihei.send': {
    effects: [{ type: 'setFlag', flag: 'fumi_send' }, ...questById.get('fumi')!.completionEffects],
    page: { pageId: 'p05-fumi', compositionId: 'fumi-send' },
    lines: [
      { by: 'ihei', text: '……そうだな。隠したところで、母にはわかる。そういう人だ。' },
      { by: 'ihei', text: '今日のうちに飛脚に頼もう。拾ってくれて、ありがとう。これは礼だ。', reward: true },
      { by: 'narration', text: '十六文を受け取った。絵巻帳に、五頁目が残った。', reward: true },
    ],
  },
  'ihei.rewrite': {
    effects: [{ type: 'setFlag', flag: 'fumi_rewrite' }, ...questById.get('fumi')!.completionEffects],
    page: { pageId: 'p05-fumi', compositionId: 'fumi-rewrite' },
    lines: [
      { by: 'ihei', text: 'なるほど。春の町のことでも書き足そうか。橋のたもとの柳が、もう青いとか。' },
      { by: 'ihei', text: 'あんたに拾ってもらった話も、書いておこう。少ないが、礼だよ。', reward: true },
      { by: 'narration', text: '十六文を受け取った。絵巻帳に、五頁目が残った。', reward: true },
    ],
  },
  'ihei.done.send': {
    lines: [{ by: 'ihei', text: '飛脚に頼んできたよ。返事が来たら、またこの道を通るさ。' }],
  },
  'ihei.done.rewrite': {
    lines: [{ by: 'ihei', text: '書き直しているところだ。柳のことを書いたら、少し長くなってしまってね。' }],
  },
} satisfies Record<string, DialogueNode>);

// 六頁目：夕暮れの灯. Only in the evening: carry the flame and light three lamps along the street.
const LIGHT = (n: number, place: string): DialogueNode => ({
  effects: [{ type: 'setFlag', flag: `yube_lit${n}` }],
  lines: [
    { by: 'narration', text: '火種を寄せると、紙の中に小さな火がゆらりと立った。' },
    { by: 'narration', text: place },
  ],
});
Object.assign(NODES, {
  'kisuke.yube.ask': {
    effects: [{ type: 'questState', quest: 'yube', state: 'discovered' }],
    lines: [
      { by: 'kisuke', text: 'おや、もう夕方か。……困ったね。灯をともして回る作爺さんが、今朝腰を痛めちまって。' },
      { by: 'kisuke', text: '橋のたもとの石灯籠、米屋の前、堀の桟橋。あの三つに火がないと、帰りの人が足元に困る。' },
      { by: 'kisuke', text: 'この火種を持って、点けて回ってくれないかい。' },
    ],
    choices: [
      { label: '点けて回る', next: 'kisuke.yube.fire' },
      { label: 'また後で', next: 'kisuke.yube.later' },
    ],
  },
  'kisuke.yube.later': {
    effects: [{ type: 'setFlag', flag: 'yube_declined' }],
    lines: [{ by: 'kisuke', text: 'そうかい。日が落ちきる前に、気が向いたら頼むよ。' }],
  },
  'kisuke.yube.fire': {
    effects: [{ type: 'setFlag', flag: 'yube_fire' }, { type: 'questState', quest: 'yube', state: 'active' }],
    recallNext: 'kisuke.yube.done',
    lines: [
      { by: 'kisuke', text: '風に気をつけてな。灯ってのは、点けて回る順番なんかどうでもいい。全部に火が入ればいいのさ。' },
      { by: 'narration', text: '小さな火種を受け取った。通りは、もう夕方の色だ。' },
    ],
  },
  'kisuke.yube.waiting': {
    lines: [{ by: 'kisuke', text: '石灯籠と、米屋の前と、堀の桟橋だよ。暗くなる前に頼む。' }],
  },
  'yube.light1': LIGHT(1, '橋を渡ってくる人の足元が、ほんのり明るくなった。'),
  'yube.light2': LIGHT(2, '米屋の前を、天秤棒の影がひとつ、灯の下を通り過ぎていく。'),
  'yube.light3': LIGHT(3, '桟橋の水面に、灯がひとつ揺れて映った。'),
  'kisuke.yube.done': {
    lines: [
      { by: 'kisuke', text: '三つとも点けてくれたかい。……ほら、ここからでも橋の灯が見える。' },
      { by: 'kisuke', text: '作爺さんはね、毎晩あれを点けて回って、もう三十年になる。' },
    ],
    choices: [
      { label: '作爺さんに知らせに行く', next: 'yube.tell' },
      { label: 'ここで灯を眺めていく', next: 'yube.watch' },
    ],
  },
  'yube.tell': {
    effects: [{ type: 'setFlag', flag: 'yube_tell' }, ...questById.get('yube')!.completionEffects],
    page: { pageId: 'p06-yube', compositionId: 'yube-tell' },
    lines: [
      { by: 'narration', text: '茶店の裏の長屋で、作爺さんは布団の上から身を起こした。' },
      { by: 'narration', text: '「そうかい、三つとも点けてくれたかい」と、作爺さんは何度もうなずいた。' },
      { by: 'kisuke', text: '作爺さんから、これを渡してくれって。手間賃だそうだ。', reward: true },
      { by: 'narration', text: '十四文を受け取った。絵巻帳に、六頁目が残った。', reward: true },
    ],
  },
  'yube.watch': {
    effects: [{ type: 'setFlag', flag: 'yube_watch' }, ...questById.get('yube')!.completionEffects],
    page: { pageId: 'p06-yube', compositionId: 'yube-watch' },
    lines: [
      { by: 'narration', text: '喜助が、湯気の立つ茶を縁台に置いた。通りの灯が、ひとつずつ遠くまで続いている。' },
      { by: 'kisuke', text: '灯ってのは、点けた人には見えないもんだと、作爺さんがよく言ってた。……今夜は、あんたが見る番だ。' },
      { by: 'kisuke', text: 'これは作爺さんの分の手間賃だ。取っといてくれ。', reward: true },
      { by: 'narration', text: '十四文を受け取った。絵巻帳に、六頁目が残った。', reward: true },
    ],
  },
  'kisuke.yube.after': {
    lines: [{ by: 'kisuke', text: '今夜も灯が入ってるね。作爺さんも、もうじき起きられるそうだ。' }],
  },
} satisfies Record<string, DialogueNode>);

// 町の写生: tapping one of the places offers to draw it, until its page is made
for (const k of SKETCHES) {
  NODES[`sk.${k.id}`] = {
    lines: [
      { by: 'narration', text: AMBIENT[k.spots[0]] },
      { by: 'narration', text: `${k.title}。足を止めて、この景色を写しておこうか。` },
    ],
    choices: [{ label: 'この景色を写す', next: `sk.${k.id}.made` }, { label: '眺めるだけにする' }],
  };
  NODES[`sk.${k.id}.made`] = {
    page: { pageId: sketchPageId(k.id), compositionId: `sketch-${k.id}-{tod}` }, // drawn in the time shown
    lines: [{ by: 'narration', text: `しばらく筆を走らせた。絵巻帳に「${k.title}」の頁が残った。` }],
  };
}

// After a story, the person can be talked with a little more (即興のひとこと).
for (const id of ['seita.done', 'seita.again', 'okon.done', 'okon.again', 'kinji.done', 'kinji.done.entrust', 'kisuke.done3', 'oharu.done3', 'sokichi.done', 'sokichi.full', 'sokichi.full.again']) {
  NODES[id].choices = [{ label: '少し話す', talk: true }];
}

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
  'omatsu.done': {
    morning: { by: 'omatsu', text: 'この時分の河岸がいちばん忙しいよ。亀吉も、舟を手伝うつもりでいる。' },
    evening: { by: 'omatsu', text: '舟がみんな戻ってきた。今日の河岸も、これでおしまいだ。' },
  },
  'kame.done': {
    morning: { by: 'kamekichi', text: '一番舟、もう見たかい？ おいらは見たぞ！' },
    evening: { by: 'kamekichi', text: 'ばあちゃんがもう帰るって。……明日も来るよな？' },
  },
  'ihei.done.send': {
    morning: { by: 'ihei', text: '今朝、飛脚に渡したよ。足の速そうな男だった。' },
    evening: { by: 'ihei', text: '母から返事が来るのは、早くて十日後だそうだ。待つのも悪くない。' },
  },
  'ihei.done.rewrite': {
    morning: { by: 'ihei', text: '朝のうちに書き直そうと思ってね。……まだ一行目だが。' },
    evening: { by: 'ihei', text: '書き直した文、今夜のうちに封をするよ。柳のことも書いた。' },
  },
};
for (const [base, byTime] of Object.entries(AT_TIME)) {
  for (const [t, line] of Object.entries(byTime)) NODES[`${base}@${t}`] = { ...NODES[base], lines: [line!] };
}

/** Where each finished story is replayed from in 回想. */
export const RECALL_START: Record<string, string> = {
  kaze: 'kaze.pressed',
  dougu: 'okon.ask',
  tenugui: 'oharu.ask',
  kashi: 'omatsu.ask',
  fumi: 'fumi.found',
  yube: 'kisuke.yube.ask',
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
    { when: { flag: 'book_full' }, node: 'sokichi.full.again' },
    { when: { pagesAtLeast: PAGE_SLOTS }, node: 'sokichi.full' },
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
  lamp1: [{ node: 'yube.light1' }],
  lamp2: [{ node: 'yube.light2' }],
  lamp3: [{ node: 'yube.light3' }],
  kisuke: [
    // 夕暮れの灯 (evening only); his other words at other times
    { when: { all: [{ quest: 'yube', is: 'complete' }, { time: 'evening' }] }, node: 'kisuke.yube.after' },
    { when: { all: [{ flag: 'yube_lit1' }, { flag: 'yube_lit2' }, { flag: 'yube_lit3' }, { not: { quest: 'yube', is: 'complete' } }] }, node: 'kisuke.yube.done' },
    { when: { all: [{ flag: 'yube_fire' }, { not: { quest: 'yube', is: 'complete' } }] }, node: 'kisuke.yube.waiting' },
    { when: { all: [{ time: 'evening' }, { quest: 'dougu', is: 'complete' }, { quest: 'tenugui', is: 'complete' }, { not: { quest: 'yube', is: 'complete' } }] }, node: 'kisuke.yube.ask' },
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
  omatsu: [
    { when: { flag: 'kashi_watched' }, node: 'omatsu.done.watch' },
    { when: { quest: 'kashi', is: 'complete' }, node: 'omatsu.done' },
    { when: { flag: 'kashi_search' }, node: 'omatsu.searching' },
    { when: { all: [{ quest: 'kaze', is: 'complete' }, { flag: 'kashi_declined' }] }, node: 'omatsu.ask.again' },
    { when: { quest: 'kaze', is: 'complete' }, node: 'omatsu.ask' },
    { node: 'omatsu.first' },
  ],
  fumi: [{ node: 'fumi.found' }],
  ihei: [
    { when: { flag: 'fumi_send' }, node: 'ihei.done.send' },
    { when: { flag: 'fumi_rewrite' }, node: 'ihei.done.rewrite' },
    { node: 'ihei.receive' },
  ],
  kamekichi: [
    { when: { quest: 'kashi', is: 'complete' }, node: 'kame.done' },
    { node: 'kame.found' },
  ],
  // the papers themselves: one tap helps (spec §6 10〜30秒)
  papers: [{ node: 'kaze.pressed' }],
};

/** Effects applied when a node is closed after being read (e.g. 再会 markers). */
export const ON_CLOSE: Record<string, Effect[]> = {
  'seita.done': [{ type: 'setFlag', flag: 'seita_seen_done' }],
  'okon.done': [{ type: 'setFlag', flag: 'okon_seen_done' }],
};
