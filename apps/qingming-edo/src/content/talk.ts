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
export const TALK_TURNS = 4;

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
  omatsu: {
    today: '今日の河岸は、舟の入りがよかったよ。春の魚は、身がやわらかいんだ。',
    work: '魚は朝のうちに売り切るのが勝負さ。昼を過ぎたら、もう値が落ちるからね。',
    earlier: '亀吉のこと、ありがとうね。あの子、父親に似て、舟が好きでしょうがないのさ。',
  },
  ihei: {
    today: '今日は両替の客が多くてね。春は、商いの金がよく動くんだ。',
    work: 'そろばんは嘘をつかないが、人の顔は数に出ない。そこが難しいところでね。',
    earlier: 'あの文、拾ってもらって本当に助かった。……母への便りは、もう少しまめに出そうと思うよ。',
  },
};

/**
 * 今日の町のこと, when the script answers: the evening and the rain have their own word
 * (the base lines above are the morning and noon). The rain wins over the hour.
 */
export const TODAY_AT: Record<string, { evening: string; rain: string }> = {
  seita: {
    evening: '夕方は、紙を片づける時刻なんです。日が傾くと、紙の色がほんの少し黄ばんで見えるのが好きで。',
    rain: '雨の日は紙を奥へしまって、店先は戸を半分だけ。湿気は紙の大敵ですから、今日は気が抜けません。',
  },
  okon: {
    evening: '日が暮れると、通りの音がひとつずつ減っていくだろう。うちも、道具に布をかけておしまいさ。',
    rain: '雨だと客足は落ちるけど、そのぶん手入れがはかどるのさ。漆は、湿り気がちょうどいいくらいでね。',
  },
  kinji: {
    evening: '夕方は売れ残りとの勝負よ。この時刻に声を張ると、晩のおかずを探しに来る人がいるんだ。',
    rain: '雨の日の振売りは骨が折れるぜ。天秤棒の荷に笠をかぶせて、軒から軒へ渡り歩くのさ。',
  },
  kisuke: {
    evening: '夕方は、帰りがけの客が一杯だけ飲んでいくんだ。朝より話が長くなるのは、なんでだろうね。',
    rain: '雨の日は、軒先に雨宿りの人が寄ってくる。茶を一杯出すと、たいてい晴れるまで話していくよ。',
  },
  oharu: {
    evening: '夕方のお使いは急ぎ足です。暗くなる前に、言付けを全部届けておきたくて。',
    rain: '雨の日は、包みを濡らさないように胸に抱えて走るんです。届け先で「よく濡らさなかったね」って言われると、うれしくて。',
  },
  sokichi: {
    evening: '……夕方は、影が長い。人の形が、地面にもう一つできる。描くなら今だ。',
    rain: '……雨の日は、色が沈む。そのぶん、線がよく見える。',
  },
  omatsu: {
    evening: '夕方の河岸は静かなもんさ。舟も片づいて、残った魚を安く分けてやる時刻だよ。',
    rain: '雨の河岸は、足もとが滑ってね。亀吉にも、石段では走るなって言ってあるんだけど。',
  },
  ihei: {
    evening: '夕方は帳面を締める時刻でね。今日の銭が合うと、肩の荷がひとつ下りるんだ。',
    rain: '雨の日は得意先回りが大変だよ。そろばんの包みだけは、濡らすわけにいかないからね。',
  },
};

/** The script's 今日の町のこと for the hour and the weather the player sees. */
export function todayLine(who: string, hour: 'morning' | 'noon' | 'evening', rain: boolean): string | undefined {
  const at = TODAY_AT[who];
  if (at && rain) return at.rain;
  if (at && hour === 'evening') return at.evening;
  return FALLBACK[who]?.today;
}

export const TALK_CLOSE: Record<string, string> = {
  seita: 'あ、番頭さんが呼んでる。また寄ってくださいね。',
  okon: 'さて、手入れの続きをしなくちゃ。また顔を見せておくれ。',
  kinji: 'おっと、午後の商いだ。またな！',
  kisuke: 'お客だ。また寄っておくれ、一杯淹れるよ。',
  oharu: 'あ、次のお使いが。ありがとうございました。',
  sokichi: '……さあ、描きに行け。',
  omatsu: 'さあ、残りの魚を売っちまわないと。また河岸においで。',
  ihei: 'おっと、得意先へ回らないと。またこの道で。',
};
