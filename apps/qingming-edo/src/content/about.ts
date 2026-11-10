// 人のこと (owner's demo feedback 2026-11-04: more dialogue): in 少し話す, ask one person about
// another. The town is a web of people who know each other; each says how they see the other.
// Only people whose story the player has shared can be asked about (宗吉 always); a few
// lines change once a later story has happened. Scripted, never generated; nothing changes.

/** Whom the player knows well enough to ask about: the story they were part of. */
export const KNOWN_BY: Record<string, string | null> = {
  sokichi: null,
  seita: 'kaze',
  okon: 'dougu',
  kinji: 'dougu',
  kisuke: 'tenugui',
  oharu: 'tenugui',
  inkyo: 'tenugui',
  omatsu: 'kashi',
  kamekichi: 'kashi',
  ihei: 'fumi',
};

type About = string | { text: string; later: [quest: string, text: string] };

/** ABOUT[speaker][subject]: what the speaker says of the subject. */
export const ABOUT: Record<string, Record<string, About>> = {
  seita: {
    sokichi: '宗吉さまは、うちの紙をずっと使ってくださってるんです。「紙の目を見ろ」って、番頭さんより厳しいかもしれません。',
    okon: 'くれ竹のおかみさんは、うちの番頭さんと幼なじみなんですよ。言い合いしてても、仲はいいんです。',
    kinji: '金次さんは、朝いちばんに店の前を通るんです。あの売り声で、ああ朝だなって。',
    kisuke: { text: '喜助さんの茶店には、番頭さんのお使いでよく行きます。……つい長居しちゃうんですけど。', later: ['neko', 'こはくが戻ってから、喜助さん、ずっと上機嫌ですよ。お茶がいつもより熱いくらいで。'] },
    oharu: 'お春ちゃんは町じゅうのお使いをしてるから、どの店の話もよく知ってるんです。',
    ihei: { text: '伊兵衛さんは、手紙用の紙をうちで買っていかれるんです。いつもいちばんいい紙を。……出すのは、なかなかみたいですけど。', later: ['fumi', '伊兵衛さん、この前は手紙の紙を三枚もまとめて買っていかれました。'] },
    inkyo: 'ご隠居さまは、昔はうちのお得意さまだったそうです。俳句を書く短冊を、よく。',
  },
  okon: {
    sokichi: '宗吉さんかい。若いころは筆より口が達者だったって、あたしの母親が言ってたよ。',
    seita: '青葉屋の清太さんは、真面目すぎるのが玉に瑕だねえ。でも、ああいう子がいつか店を持つんだよ。',
    kinji: '金次さんの天秤棒はね、親父さんの代からのものなんだ。だから手入れはうちでって、決めてくれてるのさ。',
    kisuke: '喜助さんの茶はうまいよ。あの人は、客の話を聞くのが商いみたいなもんだからね。',
    oharu: 'お春ちゃんには、うちの品もよく届けてもらってる。足が速くて、言付けを間違えない。たいしたもんさ。',
    omatsu: '河岸のおまつさんとは、魚と包丁の付き合いさ。あの人の包丁、研ぐのはうちなんだよ。',
    inkyo: 'ご隠居さんの杖、あれもうちで直したんだよ。おかみさんが生きてたころに、二人で選びに来てね。',
  },
  kinji: {
    sokichi: '宗吉さん？ 前においらを描いてくれたことがあってさ。……天秤棒ばっかり細かく描いてあったけどな！',
    seita: '清太は真面目だよなあ。たまには川端で涼もうぜって誘うんだけど、番頭さんがこわいってさ。',
    okon: 'お紺さんには頭が上がらねえ。親父の道具のこと、おいらより知ってるんだから。',
    kisuke: '喜助さんとこの団子は、売り歩きの合間の楽しみなんだ。……代金は、ちゃんと払ってるぜ？',
    oharu: 'お春ちゃんは、町でいちばん足が速えんじゃねえかな。おいらでも追いつけねえ。',
    omatsu: 'おまつさんの河岸は、おいらの仕入れ先さ。朝の舟の話を聞くのが楽しみでね。',
    kamekichi: '亀吉か！ あいつ、おいらの天秤棒を担ぎたがってしょうがねえんだ。十年早えや。',
  },
  kisuke: {
    sokichi: '宗吉さんは、いつもいちばん奥の縁台でね。茶を一杯、半刻かけてゆっくり飲むんだ。',
    seita: '清太さんは、お使いのついでに寄ってくれる。茶を飲むと、急に口がなめらかになるんだよ。',
    okon: 'お紺さんは、うちの茶釜の恩人さ。ひびを直してもらってね、もう二十年使ってる。',
    kinji: '金次はね、腹が減ると顔に出る。団子を一本おまけすると、町いちばんの笑顔になるよ。',
    oharu: 'お春ちゃんは、ご隠居のことになると一生懸命でね。いい子だよ、ほんとに。',
    ihei: { text: '伊兵衛さん、うちの縁台でよく手紙を書きかけては、やめてたよ。', later: ['fumi', '伊兵衛さん、近ごろは手紙を書き上げてから茶を飲むようになった。顔つきが違うね。'] },
    inkyo: 'ご隠居は毎朝、同じころに来て、同じ茶を頼む。おかみさんが生きてたころから、ずっとね。',
  },
  oharu: {
    sokichi: '宗吉さまの絵、お使いの途中にちらっと見たことがあります。町の人が、みんな動いてるみたいでした。',
    seita: '清太さんは、紙の包みをいつもきれいに結んでくれるんです。走っても崩れたことがありません。',
    okon: 'お紺さんは、お使いの帰りによくお菓子をくださるんです。「子どもは甘いもん食べな」って。……わたし、もう子どもじゃないんですけど。',
    kinji: '金次さんの売り声、町のどこにいても聞こえるんです。いまどのへんにいるか、すぐわかります。',
    kisuke: '喜助さんは、町の人のことなら何でも知ってます。お茶を出しながら、ぜんぶ聞いてるんですよ。',
    inkyo: { text: 'ご隠居さまには、小さいころから字を教わってるんです。お使いの書付も、ご隠居さまに習った字なんですよ。', later: ['inkyo', 'ご隠居さま、川端まで歩けたのが本当にうれしかったみたいです。毎日その話ばかりなさるんですよ。'] },
  },
  sokichi: {
    seita: '……清太の紙の扱いは、いい。紙をただの品として見ておらん。',
    okon: 'お紺は、道具の声を聞く。わしらが線の声を聞くのと、同じことだ。',
    kinji: '金次の肩の線は、描きがいがある。毎日の重さが、形になっておる。',
    kisuke: '喜助の茶店は、町の人がみな通るところだ。描くなら、あそこに座っておれ。',
    oharu: 'お春は、町の糸だ。あの子が歩くと、家と家がつながる。',
    omatsu: 'おまつの手を見たか。あれは、五十年魚をさばいてきた手だ。',
    ihei: { text: '伊兵衛は、数ばかり見て、人を見ておらん……と、前は思っておった。', later: ['fumi', '伊兵衛は、変わったな。郷から返事が届いたそうだ。'] },
    inkyo: 'ご隠居とは、古い付き合いだ。おかみさんの染めた布を、わしも一枚描いたことがある。',
  },
  omatsu: {
    sokichi: '宗吉さん？ あの人、若いころは河岸で魚の絵ばっかり描いてたよ。売り物を勝手にね。',
    okon: 'お紺さんの研いだ包丁は、ひと月もつんだよ。ほかじゃ、こうはいかない。',
    kinji: '金次はね、売れ残りを引き取ってくれるのさ。口は悪いが、気のいい子だよ。',
    kisuke: { text: '喜助さんの茶店はね、亀吉の隠れ場所のひとつなのさ。', later: ['neko', '喜助さんの茶店で、亀吉がこはくと並んで昼寝してたよ。どっちが猫だか。'] },
    kamekichi: '亀吉の父親は舟乗りでね。いまは遠くの湊さ。だから舟が着くと、ああして見に行くんだよ。',
    ihei: '伊兵衛さんは、河岸の売り上げを両替してくれる人さ。数えるのが速いのなんの。',
  },
  ihei: {
    sokichi: '宗吉さんの絵は、値のつけようがないね。……いや、両替屋がそれを言っちゃおしまいか。',
    seita: '青葉屋さんの紙は、手紙に使ってる。書き損じても、捨てるのが惜しい紙でね。',
    kisuke: '喜助さんの茶店の縁台は、考えごとにちょうどいい。ただ、長居すると話を聞き出される。',
    kinji: '金次さんの小銭の勘定は、いつもぴたりと合ってる。ああ見えて、きちんとした人なんだよ。',
    omatsu: '河岸のおまつさんは、銭を数えるのがわたしより速いかもしれない。何十年もやってるからね。',
    oharu: 'お春さんが、郷への飛脚屋を教えてくれたんだ。あの子は、町の道をみんな知ってる。',
  },
};

/** The people the speaker can be asked about now, in the town's order. */
export function aboutWhom(speaker: string, complete: readonly string[]): string[] {
  return Object.keys(KNOWN_BY).filter((who) => {
    const q = KNOWN_BY[who];
    return who !== speaker && ABOUT[speaker]?.[who] && (q === null || complete.includes(q));
  });
}

/** What the speaker says of the subject, given the stories done. */
export function aboutLine(speaker: string, subject: string, complete: readonly string[]): string {
  const a = ABOUT[speaker]?.[subject];
  if (!a) return '……';
  if (typeof a === 'string') return a;
  return complete.includes(a.later[0]) ? a.later[1] : a.text;
}
