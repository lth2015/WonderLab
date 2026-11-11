import type { Condition, SaveData } from '../contract';
import { hasFlag } from '../engine/state';
import type { DialogueNode, Line } from './types';

// 宗吉の謎かけ (owner: 「像《仙剑奇侠传》，想要对话、寻宝、地图」). Once every lost thing is back
// with its owner, 宗吉 sets a small treasure hunt: three of his own early sketches, hidden in the
// town when he was young. He gives one riddle at a time; the answer is a thing in the street
// (an ambient spot), and tapping it there finds the sketch. Brought back, he tells of it and gives
// the next riddle. Nothing marks the map: the riddle is the clue (it can be read again in 持ち物).

export interface Nazo {
  id: string;
  /** The ambient spots (targetId) that answer it. */
  spots: string[];
  /** The riddle, as 宗吉 says it and 持ち物 shows it. */
  riddle: string;
  /** Where it is, once found (持ち物). */
  place: string;
  find: string;
  /** What 宗吉 says when it is brought to him. */
  show: string[];
}

export const NAZO: Nazo[] = [
  {
    id: 'ike', spots: ['pond'], place: '庭の池',
    riddle: '静かな庭に、空を映す鏡がある。石を投げれば割れるが、すぐ元に戻る。そのほとりを探せ。',
    find: '池のほとりの石の下に、油紙の包みが挟まっていた。開くと、若い筆の下絵——池と梅の枝が描いてある。',
    show: ['見つけたか。……梅の枝が多すぎるな。若いころは、見えたものを全部描こうとした。'],
  },
  {
    id: 'ai', spots: ['dye-cloth'], place: '紺屋の干し場',
    riddle: '空に、青い川が流れている。水は一滴もないのに、風が吹けば波が立つ。その下だ。',
    find: '干し場の竿の根もとに、油紙の包みが結わえてあった。風にはためく藍の布を描いた下絵だ。線が、ずいぶん急いでいる。',
    show: ['藍の布か。あの日は風が強くてな。布が逃げてしまう前にと、急いで描いた。'],
  },
  {
    id: 'nobori', spots: ['banner', 'cloth-banner'], place: '大通りの幟',
    riddle: '店の名を背負って、背伸びしたまま一日じゅう立っている者がいる。風が吹くたび、うなずいてばかりだ。その足もとを見よ。',
    find: '幟の竿の足もとの石の陰に、最後の包みが差し込んであった。大通りの人の波を描いた下絵だ。人が多すぎて、紙からはみ出している。',
    show: [
      '三枚そろったな。',
      '師匠に見せる前に、恥ずかしくなって隠したものだ。……いま見ると、下手だが、悪くない。この町が好きで描いた線だ。',
      '持っていけ。おまえの絵巻帳に挟んでおくといい。',
    ],
  },
];

const ORDINAL = ['一つ目', '二つ目', '三つ目'];
export const nazoFlag = (step: 'given' | 'found' | 'shown', i: number) => `nazo_${step}_${NAZO[i].id}`;
export const NAZO_DONE = `nazo_shown_${NAZO[NAZO.length - 1].id}`;

/** The riddle being worked on (told, not yet found), or -1. */
export function nazoOpen(s: SaveData): number {
  return NAZO.findIndex((_, i) => hasFlag(s, nazoFlag('given', i)) && !hasFlag(s, nazoFlag('found', i)));
}

/** The node a tap on an ambient spot opens, if it answers the riddle being worked on. */
export function nazoAt(s: SaveData, targetId: string): string | null {
  const i = nazoOpen(s);
  return i >= 0 && NAZO[i].spots.includes(targetId) ? `nazo.${NAZO[i].id}.find` : null;
}

/** What 持ち物 lists: the riddle being worked on, a sketch found and not yet shown, or the three. */
export function nazoCarried(s: SaveData): string[] {
  if (hasFlag(s, NAZO_DONE)) return ['宗吉の若いころの下絵（三枚）'];
  return NAZO.flatMap((n, i) => {
    if (!hasFlag(s, nazoFlag('given', i)) || hasFlag(s, nazoFlag('shown', i))) return [];
    return hasFlag(s, nazoFlag('found', i)) ? [`見つけた下絵（${n.place}で）——宗吉さんに見せる`] : [`宗吉の謎（${ORDINAL[i]}）：「${n.riddle}」`];
  });
}

const riddleLine = (i: number): Line => ({ by: 'sokichi', text: `${ORDINAL[i]}。${NAZO[i].riddle}` });

export function nazoNodes(): Record<string, DialogueNode> {
  const nodes: Record<string, DialogueNode> = {
    'nazo.start': {
      effects: [{ type: 'setFlag', flag: nazoFlag('given', 0) }],
      lines: [
        { by: 'sokichi', text: 'ついでだ、ひとつ遊んでみるか。' },
        { by: 'sokichi', text: 'わしがおまえくらいの歳に描いた下絵を、三枚、この町に隠してある。師匠に見せる前に、恥ずかしくなってな。' },
        { by: 'sokichi', text: '謎をひとつずつ出す。見つけたら、持ってこい。' },
        riddleLine(0),
        { by: 'narration', text: '謎は、持ち物からいつでも読み返せる。' },
      ],
    },
  };
  NAZO.forEach((n, i) => {
    nodes[`nazo.${n.id}.find`] = { effects: [{ type: 'setFlag', flag: nazoFlag('found', i) }], lines: [{ by: 'narration', text: n.find }] };
    const last = i === NAZO.length - 1;
    nodes[`nazo.${n.id}.show`] = {
      effects: [{ type: 'setFlag', flag: nazoFlag('shown', i) }, ...(last ? [] : [{ type: 'setFlag' as const, flag: nazoFlag('given', i + 1) }])],
      lines: [
        ...n.show.map((text) => ({ by: 'sokichi', text })),
        ...(last ? [{ by: 'narration', text: '宗吉の若いころの下絵を三枚、もらった。' }] : [{ by: 'sokichi', text: i === NAZO.length - 2 ? '最後だ。' : '次だ。' }, riddleLine(i + 1)]),
      ],
    };
  });
  return nodes;
}

// 路人に謎を聞く: while a riddle is open, a passer-by can be asked about it. Each knows one,
// from their own work (the monk of still water, the carpenter of poles); of the others they
// say they cannot tell. (App turns `pass.<id>.nazo` into one of these as it opens.)
export const NAZO_Q = '宗吉さんの謎、わかりますか';

/** A riddle is being worked on (told, not yet found). */
export const NAZO_OPEN: Condition = { any: NAZO.map((_, i) => ({ all: [{ flag: nazoFlag('given', i) }, { not: { flag: nazoFlag('found', i) } }] })) };

export const NAZO_HINTS: Record<string, { nazo: string; hint: string[]; dunno: string }> = {
  'pass-samurai': {
    nazo: 'nobori',
    hint: ['背伸びして立ち、風が吹くたびうなずく者……。ははあ、戦場の旗指物を思い出すな。', '町でいえば、店先に立てる幟であろう。'],
    dunno: '謎か。……わしは剣より頭が固くてな。ほかの者に聞いてみるとよい。',
  },
  'pass-monk': {
    nazo: 'ike',
    hint: ['鏡、でございますか。……禅の庭では、水を心の鏡にたとえます。', '静かな水ほど、よく空を映します。どこか、静かな庭の水をごらんなさい。'],
    dunno: '……さて。拙僧には、解けそうにありません。歩きながら、考えておきましょう。',
  },
  'pass-fishmonger': {
    nazo: 'ike',
    hint: ['割れてもすぐ元に戻る鏡？ そりゃ水だろ。魚屋は水のことならわかるんだ。', 'もっとも、海でも堀でもねえ、波の立たねえ静かな水だな。庭の池でも見てきな。'],
    dunno: 'わかんねえな。魚のことなら何でも聞いてくれ。',
  },
  'pass-apprentice': {
    nazo: 'ai',
    hint: ['青い川……。あっ、わかったかもしれません。', 'お店に布を納めに来る紺屋さんの裏、干し場に行くと、頭の上を青い布が川みたいに流れてるんです。'],
    dunno: 'う、うーん……。旦那さまなら、わかるかもしれないんですけど。',
  },
  'pass-parasol': {
    nazo: 'ike',
    hint: ['割れても、すぐ元に戻る鏡……水じゃないかしら。', '日傘をさして歩くと、水たまりにも空が映るんですよ。きっと、お庭の池とか。'],
    dunno: 'ごめんなさい、謎かけは苦手で……。',
  },
  'pass-porter': {
    nazo: 'ai',
    hint: ['水のねえ青い川だ？ そんなら知ってるぜ。', '紺屋の裏を荷をかついで通るとな、頭の上を藍の布がざあざあ流れてやがるんだ。'],
    dunno: 'わからねえな。荷の重さなら、持ちゃあわかるんだが。',
  },
  'pass-hikyaku': {
    nazo: 'nobori',
    hint: ['走ってると、店の目印は幟でわかるんだ。', 'あいつら、風が吹きゃぺこぺこ頭を下げてらあ。竿の足もとでも見てみな。'],
    dunno: 'わかんねえ。走りながら考えとくよ。じゃあな！',
  },
  'pass-daiku': {
    nazo: 'nobori',
    hint: ['一日じゅう背伸びして立ってる……そりゃ竿だな。店先の幟の竿だ。', '竿の足もとはな、倒れねえように石で押さえてあるもんだ。何か挟むなら、そこよ。'],
    dunno: 'さあな。柱や梁のことなら、何でも答えてやるんだが。',
  },
  'pass-ameuri': {
    nazo: 'ai',
    hint: ['それなら、子どもらが言ってたよ。「空に青い川がある」って。', '紺屋の干し場のことさ。風が吹くと、本当に波みたいに揺れるんだ。'],
    dunno: 'わかんないねえ。子どもらに聞いてみようか。',
  },
};

/** The node a passer's answer opens: their hint if the open riddle is theirs, else their 'cannot tell'. */
export function nazoHintNode(s: SaveData, id: string): string {
  const i = nazoOpen(s);
  return i >= 0 && NAZO_HINTS[id]?.nazo === NAZO[i].id ? `pass.${id}.nazo.hint` : `pass.${id}.nazo.dunno`;
}
