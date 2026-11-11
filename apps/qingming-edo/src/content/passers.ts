// 通りすがりの人と話す (owner, 2026-11-10: passers-by stop and talk, about their own work).
// A tap on a walking passer-by stops them (the street holds still while a dialogue is open)
// and opens a short conversation: their greeting, then three things to ask about their work,
// asked in any order, as often as liked; a parting word. Scripted; nothing changes.
// ご隠居 also walks the street but is a person of the stories, so he keeps his one word.

import type { SaveData } from '../contract';
import { hasFlag, questState } from '../engine/state';
import { LOST } from './lost';

export interface PasserTalk {
  /** Shown as the speaker (they are not in the 人物帳). */
  name: string;
  role: string;
  /** What happens as they stop, then their first word. */
  stop: string;
  hello: string;
  /** Their greeting when met again (after the first talk). */
  again: string;
  /** The word that brings the questions back after an answer. */
  more: string;
  topics: { q: string; a: string[] }[];
  /** 落とし物を見かけたか (the fourth question): their word before telling where something glinted, */
  glimpse: string;
  /** and their word when nothing is left lying in the street. */
  none: string;
  /** A small thing they ask, after one answer, once the player knows who can help (see Favor). */
  favor?: Favor;
  bye: string;
}

/**
 * 路人のちょっとした頼み: after the answer to topic `after`, the passer asks something only a
 * person of the stories can help with. Pointing them there is all the player does; the next
 * time that person is spoken to, they mention the passer came by (once). Nothing is paid.
 */
export interface Favor {
  after: number;
  /** The person who can help, and their story, done first (so the player knows them). */
  who: string;
  needs: string;
  ask: string;
  /** What the player says, and the passer's thanks. */
  offer: string;
  thanks: string[];
  /** What `who` says of it afterwards. */
  told: string;
}

export const PASSERS: Record<string, PasserTalk> = {
  'pass-samurai': {
    name: '通りがかりの武士',
    role: '国元から江戸詰めの侍',
    stop: '黒羽織の武士が、扇子を閉じて足を止めた。',
    hello: 'おう、絵師の見習いか。わしは国元から江戸詰めに来ておる者だ。何か用か。',
    again: 'おう、また会ったな、絵師の見習い。今日は非番でな、またぶらぶらしておる。',
    more: 'ほかに聞きたいことはあるか。',
    topics: [
      { q: '江戸詰めって、何をするんですか', a: ['藩のお屋敷で、殿のご用を勤める。といっても、毎日忙しいわけではない。', '非番の日は、こうして町を歩いておる。国元の者に江戸の様子を書き送るのも、務めのうちよ。'] },
      { q: '刀は重くないですか', a: ['重いとも。二本差せば、米を一升ずつ腰に下げているようなものだ。', 'だが、抜くことはまずない。抜かずに済ませるのが武士の腕だと、父に教わった。'] },
      { q: '国元へのお土産は決まりましたか', a: ['それよ。母上には浅草海苔、妹には錦絵と決めておる。', '……絵師の見習いなら、よい錦絵を置いている店を知らんか。'] },
    ],
    glimpse: 'そういえば、歩いておるときに目に留まったものがある。',
    none: 'いや、気づかなんだ。町は、きれいなものだな。',
    favor: {
      after: 2, who: 'seita', needs: 'kaze',
      ask: '国元の妹は、役者絵より名所絵が好きでな。江戸の景色の、よい刷りのものを探しておる。',
      offer: '紙屋の青葉屋さんなら、版元にくわしいと思います',
      thanks: ['紙屋か。なるほど、紙を扱う者なら、刷りのよしあしもわかろう。', 'かたじけない。さっそく寄ってみる。'],
      told: '黒羽織のお侍さまが、名所絵のことを聞きにみえました。版元をお教えしたら、国元の妹御に送るのだと、それはうれしそうで。……あなたのご紹介だそうですね。',
    },
    bye: 'では、また町で会おう。',
  },
  'pass-monk': {
    name: '托鉢の僧',
    role: '托鉢して歩く僧',
    stop: '笠の僧が杖を止め、静かに頭を下げた。',
    hello: '……何か、ご用でしょうか。',
    again: '……また、お会いしましたね。今日も、よく歩いておられる。',
    more: 'ほかにも、何か。',
    topics: [
      { q: '托鉢って、何をしているんですか', a: ['家々の前に立って経を読み、施しをいただきます。米ひとつかみでも、銭一文でも、ありがたいものです。', 'いただいたものは寺の暮らしと、困っている人のために使います。'] },
      { q: '一日にどれくらい歩くんですか', a: ['朝から昼まで、日本橋から神田のあたりまで。', '足を運ぶことも、経を読むのと同じ修行です。'] },
      { q: '断られることもありますか', a: ['よくあります。それもまた修行です。', '閉まる戸にも、頭を下げてから次へまいります。'] },
    ],
    glimpse: '……下を向いて歩くことが多いもので、目に入りました。',
    none: '……いいえ。今日は、何も落ちてはいないようです。',
    favor: {
      after: 1, who: 'kisuke', needs: 'tenugui',
      ask: '……この先で、少し腰を下ろして休ませていただける所は、ありましょうか。',
      offer: '茶店「喜の字」の喜助さんなら、休ませてくれます',
      thanks: ['喜の字……。ありがとうございます。', '人の情けをいただくのも、修行のうちです。'],
      told: '托鉢のお坊さんが寄ってくれてね。お代はいいって言ったら、店の前で経をひとつ読んでいったよ。……あんたに聞いたってさ。',
    },
    bye: 'よい一日を。',
  },
  'pass-fishmonger': {
    name: '魚売り',
    role: '天秤棒の棒手振り',
    stop: '魚売りが、天秤棒をかついだまま足を止めた。',
    hello: 'へい、らっしゃい！ ……なんだ、買うんじゃねえのか。ま、いいや。何だい。',
    again: 'おう、また会ったな！ 今日も魚は活きがいいぜ。',
    more: 'ほかにも何かあるかい。魚が傷まねえうちに頼むぜ。',
    topics: [
      { q: '魚はどこで仕入れるの', a: ['日本橋の魚河岸よ。夜明け前に舟が着いて、そこで買い付けるんだ。', '仕入れたら、天秤棒でかついで町じゅうを売り歩く。昼までに売り切るのが勝負さ。'] },
      { q: '今日のおすすめは', a: ['春の鯵だね。脂がのってきて、たたきにすりゃあたまらねえ。', '今日はいい鯛も一尾ある。祝いごとのある家に、声をかけて回るのさ。'] },
      { q: '売れ残ったらどうするの', a: ['干物にするか、なじみの煮売り屋に安く渡す。', '……でも、売れ残らねえように声を張るのが腕ってもんよ。'] },
    ],
    glimpse: 'おう、それなら見たぜ。売り歩いてりゃ、町じゅう目に入るからな。',
    none: 'いや、見てねえな。落ちてりゃ、とっくに誰かが拾ってらあ。',
    favor: {
      after: 2, who: 'kisuke', needs: 'tenugui',
      ask: 'そうだ、このへんに、売れ残りを引き取ってくれそうな店はねえかい。焼いて出すような所がいいんだが。',
      offer: '茶店「喜の字」の喜助さんなら、茶請けに出してくれるかも',
      thanks: ['茶店か！ 焼き魚を茶請けにってのは、悪くねえ。', 'ありがとよ。帰りに寄ってみらあ。'],
      told: '天秤棒の魚売りが寄ってね、売れ残りの鯵を安く分けてくれたんだ。焼いて茶請けに出したら、客がえらく喜んでさ。……あんたの紹介だって？',
    },
    bye: 'じゃあな！ 鯵が食いたくなったら呼んでくれ。',
  },
  'pass-apprentice': {
    name: '使いの丁稚',
    role: '呉服屋の丁稚',
    stop: '箱を抱えた丁稚が、つんのめるように足を止めた。',
    hello: 'は、はいっ。……あ、お客さまじゃないんですね。手短にお願いします、番頭さんに叱られるので。',
    again: 'あっ、この前の！ ……今日も急ぎなので、手短にお願いします。',
    more: 'ほかにも、ですか？ 手短に……。',
    topics: [
      { q: 'どこのお店の人？', a: ['呉服屋の丁稚です。十の年に奉公に上がって、もう三年になります。', '朝は店の掃除、昼はお使い、夜はそろばんの稽古です。'] },
      { q: 'その箱は何を運んでいるの', a: ['お得意さまに届ける反物です。箱ごと落としたら、ひと月分のお小遣いでも足りません。', 'お代を預かって帰るときは、もっと胸がどきどきします。'] },
      { q: 'いつか番頭さんに？', a: ['……なれたら、いいなあ。手代、番頭と上がっていくには、十年も二十年もかかるんです。', 'でも、いつか自分の店に暖簾を掛けるのが夢です。'] },
    ],
    glimpse: 'あっ、それなら……お使いの途中で見ました。',
    none: 'いいえ、見てないです。……すみません、急いでいて。',
    favor: {
      after: 1, who: 'omatsu', needs: 'kashi',
      ask: 'あの……向こう岸の河岸の、おまつさんというお得意さまのお宅、ご存じですか。初めてのお届けで……。',
      offer: 'おまつさんなら、向こう岸の河岸で魚を売っています',
      thanks: ['河岸で、魚を……！ お店じゃなくて、河岸なんですね。', '助かりました！ これで番頭さんに叱られずにすみます。'],
      told: '呉服屋の小僧さんが、反物を届けに来たよ。道をあんたに聞いたって、汗びっしょりでさ。……亀吉の晴れ着だよ。まだ内緒だけどね。',
    },
    bye: 'では、急ぎますので！ 失礼します！',
  },
  'pass-parasol': {
    name: '日傘の娘',
    role: '小間物屋の娘',
    stop: '日傘を持った娘が、こちらに気づいて足を止めた。',
    hello: 'あら、こんにちは。いいお天気ですね。',
    again: 'あら、また会いましたね。今日もお稽古の帰りなんです。',
    more: 'ほかにも、何か？',
    topics: [
      { q: 'どちらへ？', a: ['三味線のお稽古です。月に六度、お師匠さんのところへ通っているんです。'] },
      { q: 'お家は何のお店？', a: ['小間物屋です。櫛や簪、紅や白粉を商っています。', '流行りの柄はすぐ変わるから、こうして町を歩いて、みなさんの髪をこっそり見ているんですよ。'] },
      { q: 'その日傘は', a: ['うちのお店で扱っている品です。持って歩くと、どこで買えるのかって、よく聞かれるんですよ。', '……これも、商いのうちです。'] },
    ],
    glimpse: 'ええ、ひとつ。日傘の下からだと、足もとがよく見えるんですよ。',
    none: 'いいえ。今日は何も。',
    favor: {
      after: 1, who: 'oharu', needs: 'tenugui',
      ask: '町じゅうのお使いを引き受けている娘さんがいるって聞いたんです。お店の品を、お得意さまに届けてもらえないかしら。',
      offer: 'おはるさんなら、言付けを間違えません',
      thanks: ['おはるさん。……覚えておきます。', '足の速い人に頼めたら、わたし、お稽古に遅れずにすむわ。'],
      told: '小間物屋のお嬢さんから、簪を届けるお使いを頼まれるようになりました。あなたに聞いたって。……届けるたびに、ひとつずつ見とれてしまいます。',
    },
    bye: 'では、ごきげんよう。',
  },
  'pass-porter': {
    name: '荷を運ぶ人足',
    role: '問屋の荷を運ぶ人足',
    stop: '大きな荷を背負った人足が、足を止めて息をついた。',
    hello: 'ふう……。なんだい、話なら、ひと息つく間だけな。',
    again: 'よう、また会ったな。今日も荷は重いぜ。',
    more: 'ほかにもあるかい。',
    topics: [
      { q: '何を運んでいるの', a: ['問屋の荷だよ。中身は木綿だ。問屋の蔵から河岸の舟まで、一日に何度も行き来するのさ。'] },
      { q: '重くない？', a: ['重いさ。だが、腰と脚でかつぐのがこつでな。腕で持つと、三日で体が壊れる。', '紐の締め方ひとつで、荷が軽くも重くもなるんだ。'] },
      { q: '仕事はどうやって見つけるの', a: ['朝、口入れ屋に顔を出すと、その日の仕事を回してくれる。', '河岸に舟の多い日は、取り合いだ。早起きは三文の得ってのは、ほんとうさ。'] },
    ],
    glimpse: '荷をかついでると、下ばっかり見てるからな。ひとつ見たぜ。',
    none: 'いや、見てねえ。荷が重くて、それどころじゃねえや。',
    favor: {
      after: 2, who: 'kinji', needs: 'dougu',
      ask: '……舟の少ねえ日は、口にあぶれる。どこか、荷を運ぶ手の足りねえところを知らねえか。',
      offer: '振売りの金次さんが、問屋に顔が利きます',
      thanks: ['振売りの金次か。売り声のでかいあいつだな。', '恩に着るぜ。今度会ったら、荷のひとつも持ってやらあ。'],
      told: 'あんたが言ってた人足のあんちゃん、親父の代からつきあいのある問屋に口を利いといたよ。……力持ちでさ、いいやつだね。',
    },
    bye: 'さて、もうひと踏ん張りだ。',
  },
  'pass-hikyaku': {
    name: '飛脚',
    role: '町飛脚',
    stop: '文箱をかついだ飛脚が、駆け足をゆるめて止まった。',
    hello: 'おっと！ ……急ぎの文を運んでる途中でな。ひと息つく間なら、いいぜ。',
    again: 'よう、また会ったな。今日も文を抱えて走りどおしだ。',
    more: 'ほかに何かあるかい。文が待ってるんでな。',
    topics: [
      { q: 'どこからどこまで運ぶの', a: ['町飛脚は、江戸の町の中を走る。日本橋から深川、神田、四谷あたりまで、日に何十軒も回るのさ。', '遠くの国へは、宿場ごとに人を替えてつなぐ。早いもので、江戸から大坂まで六日だ。'] },
      { q: 'その箱には何が入ってるの', a: ['文と、ちょっとした荷よ。商いの知らせもあれば、母親から息子への便りもある。', '中身は読まねえ。それが飛脚の決まりさ。'] },
      { q: 'どうしてそんなに速く走れるの', a: ['こつがあってな。足を前に出すんじゃなく、体を少し前に倒すんだ。そうすりゃ足が勝手についてくる。', 'あとは草鞋の紐をきつく締めること。ゆるいと、すぐに足を痛める。'] },
    ],
    glimpse: '走りながらだが、ちらっと見たぜ。',
    none: 'いや、見てねえな。走ってると、足もとは見えねえのさ。',
    favor: {
      after: 1, who: 'ihei', needs: 'fumi',
      ask: 'そうだ、ひとつ聞きてえ。両替屋の伊兵衛って手代に、郷から返事の文が来てるんだが、どこの両替屋だか知らねえか。',
      offer: '伊兵衛さんなら、この通りの両替屋の手代さんです',
      thanks: ['この通りか！ 灯台もと暗しだ、よその町ばかり探してたぜ。', '郷からの返事ってのは、待つほうも急ぎなもんだ。すぐ届けてくる。'],
      told: '郷の母から、返事が届きました。飛脚さんが、あなたに道を聞いたと言っていました。……字が、前より少しだけ、ふるえていました。',
    },
    bye: 'じゃあな！ 文を出すときは、うちの飛脚屋へ。',
  },
  'pass-daiku': {
    name: '道具箱の大工',
    role: '棟梁のもとで働く大工',
    stop: '道具箱をかついだ大工が、曲尺を下ろして足を止めた。',
    hello: 'ん？ なんだい、絵師さんか。普請場へ行く途中だが、少しならいいぜ。',
    again: 'おう、また会ったな。今日も普請場へ通いだ。',
    more: 'ほかに聞きたいことは。',
    topics: [
      { q: '今はどんな建物を建ててるの', a: ['堀の向こうの米屋の蔵だ。米は湿気を嫌うから、壁を厚く塗って、床を高く上げるんだ。', '蔵ってのは、町のお宝の入れ物みてえなもんだからな。手は抜けねえ。'] },
      { q: 'その曲がった物差しは', a: ['曲尺よ。これ一本で、長さも直角も、柱の太さの割り出しもできる。', '親方は、目盛りの擦り減り方を見れば、大工の腕がわかると言うんだ。'] },
      { q: '大工になるにはどれくらいかかるの', a: ['弟子入りして十年だ。最初の三年は、鉋の刃を研ぐのと、木っ端拾いばかりさ。', '江戸は火事が多いから、大工の仕事はなくならねえ。……ありがたいことかどうかは、わからねえがな。'] },
    ],
    glimpse: '見たぜ。大工は、目の端で寸法を測る癖があるからな。',
    none: 'いや、見てねえ。普請場の木っ端なら、山ほど落ちてるがな。',
    favor: {
      after: 2, who: 'okon', needs: 'dougu',
      ask: '……そういや、鉋の刃がひとつ欠けちまってな。いい刃を置いてる道具屋を知らねえか。',
      offer: '道具屋くれ竹のおかみさんなら、きっと',
      thanks: ['くれ竹か。名前は聞いたことがある。古い道具を大事にする店だってな。', 'ありがとよ。普請の帰りに寄ってみる。'],
      told: '大工さんが、鉋の刃を見に来たよ。あんたに聞いたって。……刃の研ぎ方を見りゃわかる。いい棟梁についてる人だね。',
    },
    bye: 'さて、日が高いうちに柱を一本立てちまわねえと。',
  },
  'pass-ameuri': {
    name: '飴売り',
    role: '飴細工の売り子',
    stop: '飴の盆を下げた男が、にこにこしながら足を止めた。',
    hello: 'へい、いらっしゃい！ 飴はいかが……と言いたいところだが、何だい、話かい。',
    again: 'おや、また会ったね！ 今日の飴は、鳥と兎だよ。',
    more: 'ほかには何だい。',
    topics: [
      { q: 'その飴、どうやって作るの', a: ['温めてやわらかくした飴を、指とはさみで細工するのさ。鳥でも兎でも、目の前でこしらえる。', '冷めると固まっちまうから、手早くやるのが腕の見せどころよ。'] },
      { q: '誰がいちばん買ってくれるの', a: ['そりゃあ子どもさ。でも、子どもに買ってやる親や、じいさんばあさんも多いよ。', '茶店の前で売ると、喜助さんとこのお客がつられて買ってくれる。持ちつ持たれつだね。'] },
      { q: 'どうして笠をかぶってるの', a: ['日に当たると、飴がやわらかくなっちまうからね。盆にも小さな日よけを掛けることがある。', '……本当は、俺の頭が日に弱いってのもあるがね。'] },
    ],
    glimpse: '見た見た。飴を買いに来る子どもが、指さして教えてくれたのさ。',
    none: 'いや、見てないねえ。落ちてたら、子どもらが先に拾ってるよ。',
    favor: {
      after: 0, who: 'kamekichi', needs: 'kashi',
      ask: 'そうだ、舟の好きな坊主がいるって聞いたんだがね。舟の形の飴をこしらえたら、喜ぶかね。どこの子だい。',
      offer: '河岸のおまつさんの孫の、亀吉です',
      thanks: ['亀吉か。よし、帆までつけた舟をこしらえてやろう。', '飴細工ってのは、喜ぶ顔を思い浮かべながらやると、うまくいくのさ。'],
      told: 'ねえねえ、飴屋のおじさんが、舟の飴をこしらえてくれたんだ！ 帆もついてるの！ ……もったいなくて、まだなめてない。',
    },
    bye: 'じゃあね！ 今度は買っておくれよ。',
  },
};

/** Set once the player has talked with them (for 又会ったな, and the 人物帳). */
export const passerFlag = (id: string) => `talked_${id}`;

export const passerName = (id: string) => PASSERS[id]?.name;
export const passerRole = (id: string) => PASSERS[id]?.role;

/** The fourth question: 落とし物を見かけませんでしたか. */
export const GLIMPSE_Q = 'この辺で、落とし物を見かけませんでしたか';

/**
 * Where `pass.<id>.seen` goes, decided as it opens: one of the things still lying in the street
 * (each passer tells of a different one), or `.none`. It only says where something glinted:
 * whose it is, and the ？ on the map, still come from the owner.
 */
export function glimpseNode(save: SaveData, id: string): string {
  const lying = questState(save, 'kaze') === 'complete' ? LOST.filter((t) => !hasFlag(save, `lost_found_${t.id}`)) : [];
  if (!lying.length) return `pass.${id}.seen.none`;
  const k = Math.max(0, Object.keys(PASSERS).indexOf(id));
  return `pass.${id}.seen.${lying[k % lying.length].id}`;
}

export const favorFlag = (id: string) => `favor_${id}`;

/**
 * Where `pass.<id>.favor` goes, decided as it opens: the ask, while the player knows who can
 * help and has not yet pointed them there; otherwise straight back to the questions.
 */
export function favorNode(save: SaveData, id: string): string {
  const f = PASSERS[id]?.favor;
  return f && questState(save, f.needs) === 'complete' && !hasFlag(save, favorFlag(id)) ? `pass.${id}.favor.ask` : `pass.${id}.more`;
}
