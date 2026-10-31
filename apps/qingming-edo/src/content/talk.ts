// 即興のひとこと の台本の受け皿 (spec §12): when the generated line cannot be
// had (off, slow, over the day's limit, or unfit), the person says this instead.
// The talk always works without the model.

export type TalkTopic = 'today' | 'work' | 'earlier';
export const TALK_TOPICS: { id: TalkTopic; label: string }[] = [
  { id: 'today', label: '今日の町のこと' },
  { id: 'work', label: '仕事のこと' },
  { id: 'earlier', label: 'さっきのこと' },
];
/** Lines per visit before the person goes back to work. */
export const TALK_TURNS = 3;

export const FALLBACK: Record<string, Record<TalkTopic, string>> = {
  seita: {
    today: '今日は風もおさまって、通りがにぎやかです。紙を見に寄ってくださるお客も、いつもより多い気がします。',
    work: '紙は湿り気が大敵でして。朝いちばんに束をほどいて、風を通してから並べるんです。',
    earlier: 'あの文鎮、あれからずっと店の真ん中に置いてます。番頭さんも「いい置き場所だ」って。',
  },
  okon: {
    today: '朝の日本橋は、荷も人も声も多くてね。うちの暖簾も、ひっきりなしに揺れてるよ。',
    work: '塗り物は、使う人の手でだんだん艶が出てくるのさ。手入れはその手伝いみたいなもんだね。',
    earlier: 'あの包み、きれいに結べてたよ。ああいうのは、気持ちがそのまま形に出るんだ。',
  },
  kinji: {
    today: 'いい天気だ、商いもはかどったぜ。日本橋を渡るときの朝の川風、あれがたまらねえんだ。',
    work: '天秤棒はな、肩に乗せる場所ひとつで一日の疲れが違うんだ。親父に散々仕込まれたよ。',
    earlier: 'あの弁当箱、昼にさっそく使ったよ。なんだか親父と飯を食ってる気分になっちまった。',
  },
  kisuke: {
    today: '朝はいつもの顔ぶれが、いつもの順に来るもんでね。今日はみんな少し早かったな。',
    work: '茶はね、客の顔を見てから淹れるんだ。急いでる人と、ゆっくりしたい人じゃ、同じ茶でも違う。',
    earlier: 'あんたに運んでもらった茶、二人とも喜んでたよ。人の話をよく聞く手だね。',
  },
  oharu: {
    today: '朝の使いは、町のいろんな家の台所の匂いがして、好きなんです。',
    work: 'お使いって、品物だけじゃなくて、言付けも運ぶんです。そっちのほうが大事なときもあって。',
    earlier: 'ご隠居さま、あの手拭いを今日も腰に下げてらっしゃいました。結び目、固く結んで。',
  },
  sokichi: {
    today: '……春の朝は、影がやわらかい。描くにはいい。',
    work: '絵巻は、通りの端から端まで、人の暮らしをつなげて描くものだ。一人も置いていかん。',
    earlier: '描いた頁は、ときどき見返せ。描いたときに見えなかったものが、あとで見える。',
  },
};

export const TALK_CLOSE: Record<string, string> = {
  seita: 'あ、番頭さんが呼んでる。また寄ってくださいね。',
  okon: 'さて、手入れの続きをしなくちゃ。また顔を見せておくれ。',
  kinji: 'おっと、午後の商いだ。またな！',
  kisuke: 'お客だ。また寄っておくれ、一杯淹れるよ。',
  oharu: 'あ、次のお使いが。ありがとうございました。',
  sokichi: '……さあ、描きに行け。',
};
