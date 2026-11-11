import type { SaveData } from '../contract';
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
