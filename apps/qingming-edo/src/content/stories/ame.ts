import type { Condition, QuestDef } from '../../contract';
import { SPOTS } from '../spots';
import type { DialogueNode, Line } from '../types';
import type { Nearby, StoryModule } from './types';

// 十二頁目：雨宿り (owner: 多开发内容; demo feedback 「场景简单」). In the rain, 喜助 lends the
// tea house's three umbrellas: carry them to the people waiting under the eaves along the roll.

/** 雨宿り: who waits under which eaves in the rain (feet, scene units), read off the painting. */
export const SHELTERS: { walker: string; x: number; y: number; flip?: boolean; place: string }[] = [
  { walker: 'crowd2-samurai', x: 9560, y: 522, place: '呉服屋の軒下' },
  { walker: 'crowd2-fishmonger', x: 7560, y: 505, flip: true, place: '米屋の軒先' },
  { walker: 'crowd2-apprentice', x: 4460, y: 492, place: '瀬戸物屋の軒下' },
];

const quest: QuestDef = {
  // 十二頁目：雨宿り. In the rain: carry the tea house's three umbrellas to people under the eaves. No money.
  id: 'ame',
  prerequisites: [{ quest: 'dougu', is: 'complete' }, { quest: 'tenugui', is: 'complete' }],
  steps: [
    { id: 'go', doneWhen: { flag: 'ame_go' } },
    { id: 'give', doneWhen: { all: [{ flag: 'ame_1' }, { flag: 'ame_2' }, { flag: 'ame_3' }] } },
    { id: 'draw', doneWhen: { any: [{ flag: 'ame_street' }, { flag: 'ame_eave' }] } },
  ],
  completionEffects: [
    { type: 'familiarity', characterId: 'kisuke', eventId: 'ame' },
    { type: 'questState', quest: 'ame', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const GIVE = (n: number, lines: Line[]): DialogueNode => ({ effects: [{ type: 'setFlag', flag: `ame_${n}` }], lines });
const SHELTERED = (text: string): DialogueNode => ({ brief: true, lines: [{ by: 'narration', text }] });
const nodes: Record<string, DialogueNode> = {
  'kisuke.ame.ask': {
    effects: [{ type: 'questState', quest: 'ame', state: 'discovered' }],
    lines: [
      { by: 'kisuke', text: '急な雨だ。軒下で足止めされてる人が、きっといるな。' },
      { by: 'kisuke', text: '店の貸し傘が三本ある。困ってる人に届けてくれないか。返すのはいつでもいいって言ってな。' },
    ],
    choices: [
      { label: '傘を届けに行く', next: 'kisuke.ame.go' },
      { label: 'またにする', next: 'kisuke.ame.later' },
    ],
  },
  'kisuke.ame.later': {
    effects: [{ type: 'setFlag', flag: 'ame_declined' }],
    lines: [{ by: 'kisuke', text: 'そうか。まあ、通り雨かもしれないしな。' }],
  },
  'kisuke.ame.go': {
    effects: [{ type: 'setFlag', flag: 'ame_go' }, { type: 'questState', quest: 'ame', state: 'active' }],
    recallNext: 'kisuke.ame.done',
    lines: [{ by: 'narration', text: '番傘を三本かかえて、雨の通りへ出た。軒下で雨宿りしている人を探そう。' }],
  },
  'kisuke.ame.waiting': {
    lines: [{ by: 'kisuke', text: 'まだ傘が残ってるな。呉服屋に米屋、瀬戸物屋のあたりの軒下を見ておいで。' }],
  },
  'ame.give1': GIVE(1, [
    { by: 'narration', text: '呉服屋の軒下で、武士が空を見上げていた。傘を差し出すと、少し驚いた顔をした。' },
    { by: 'narration', text: '武士「かたじけない。国元へ送る反物を、濡らすわけにはいかなくてな」' },
  ]),
  'ame.give2': GIVE(2, [
    { by: 'narration', text: '米屋の軒先で、魚売りが籠をかばってしゃがみこんでいた。' },
    { by: 'narration', text: '魚売り「助かった！ 魚は濡れてもいいが、おいらが風邪をひいちまう」' },
  ]),
  'ame.give3': GIVE(3, [
    { by: 'narration', text: '瀬戸物屋の軒下で、丁稚が包みを抱えて震えていた。' },
    { by: 'narration', text: '丁稚「番頭さんのお使いの帰りなんです。……ありがとうございます！」' },
  ]),
  'ame.shelter1': SHELTERED('武士が呉服屋の軒下で、空を見上げている。「やみそうにないな」'),
  'ame.shelter2': SHELTERED('魚売りが米屋の軒先で、籠をかばっている。「まいったな、こりゃ」'),
  'ame.shelter3': SHELTERED('丁稚が瀬戸物屋の軒下で、包みを抱えて雨を見ている。'),
  'kisuke.ame.done': {
    lines: [
      { by: 'kisuke', text: '三本とも渡せたか。ご苦労さん。' },
      { by: 'kisuke', text: '傘ってのは、返ってこなくてもいいんだ。また誰かの雨の日に使われりゃ、それでいい。' },
    ],
    choices: [
      { label: '人のいない雨の通りを描く', next: 'ame.street' },
      { label: '茶店の軒先から雨を描く', next: 'ame.eave' },
    ],
  },
  'ame.street': {
    effects: [{ type: 'setFlag', flag: 'ame_street' }, ...quest.completionEffects],
    page: { pageId: 'p12-ame', compositionId: 'ame-street' },
    lines: [{ by: 'narration', text: '傘を差した人たちが帰っていったあとの、静かな通りを描いた。絵巻帳に、十二頁目が残った。' }],
  },
  'ame.eave': {
    effects: [{ type: 'setFlag', flag: 'ame_eave' }, ...quest.completionEffects],
    page: { pageId: 'p12-ame', compositionId: 'ame-eave' },
    lines: [{ by: 'narration', text: '茶店の縁台に腰かけて、軒から落ちる雨と喜助の背中を描いた。絵巻帳に、十二頁目が残った。' }],
  },
};

export const ame: StoryModule = {
  quest,
  nodes,
  labels: { ame1: '呉服屋の軒下の武士', ame2: '米屋の軒先の魚売り', ame3: '瀬戸物屋の軒下の丁稚' },
  hotspots: [
  // 雨宿り: in the rain three people wait under the eaves, until an umbrella reaches them
  ...SHELTERS.map((p, i) => ({
    id: `h-ame${i + 1}`,
    targetId: `ame${i + 1}`,
    kind: 'prop' as const,
    anchor: { x: p.x, y: p.y - 40 },
    hitArea: { x: p.x - 22, y: p.y - 86, w: 44, h: 88 },
    priority: 6,
    visibleWhen: { all: [{ rain: true }, { not: { flag: `ame_${i + 1}` } }, { not: { quest: 'ame', is: 'complete' } }] } as Condition,
  })),
  ],
  pages: [
    { id: 'p12-ame', triggerId: 'ame', compositionId: 'ame-{street|eave}', captionId: 'ame', sourceRefs: [] },
    { id: 'p12-ame-b', triggerId: 'ame', compositionId: 'ame-{street|eave}', captionId: 'ame', sourceRefs: [] },
  ],
  titles: {
    'p12-ame': '雨宿り',
    'p12-ame-b': '雨宿り（もう一枚）',
  },
  recallStart: 'kisuke.ame.ask',
  place: {
    'ame-street': '日本橋・雨　米屋の前の往来',
    'ame-eave': '日本橋・雨　茶店「喜の字」の軒先',
  },
  comment: {
    'ame-street': '人のいない雨の通りに、さっきまでの人の気配が残っている。雨は線ではなく、間で描くものだ。',
    'ame-eave': '軒から落ちる雨を、内側から見たか。濡れない場所から見る雨は、やさしい色をしている。',
  },
  recallNote: 'もう一つの場面を描けば、別の頁が残ります。',
  entries: {
    // in the rain, which the player chose, before the evening's lamps (after the umbrellas are out, whatever the weather)
    kisuke: [
      { rank: 100, when: { all: [{ flag: 'ame_1' }, { flag: 'ame_2' }, { flag: 'ame_3' }, { not: { quest: 'ame', is: 'complete' } }] }, node: 'kisuke.ame.done' },
      { rank: 101, when: { all: [{ flag: 'ame_go' }, { not: { quest: 'ame', is: 'complete' } }] }, node: 'kisuke.ame.waiting' },
      { rank: 102, when: { all: [{ rain: true }, { not: { quest: 'ame', is: 'complete' } }] }, node: 'kisuke.ame.ask' },
    ],
    ame1: [
      { rank: 100, when: { flag: 'ame_go' }, node: 'ame.give1' },
      { rank: 101, node: 'ame.shelter1' },
    ],
    ame2: [
      { rank: 100, when: { flag: 'ame_go' }, node: 'ame.give2' },
      { rank: 101, node: 'ame.shelter2' },
    ],
    ame3: [
      { rank: 100, when: { flag: 'ame_go' }, node: 'ame.give3' },
      { rank: 101, node: 'ame.shelter3' },
    ],
  },
  valid: (pageId, compositionId) => (pageId === 'p12-ame' || pageId === 'p12-ame-b' ? compositionId === 'ame-street' || compositionId === 'ame-eave' : null),
  // rain over the picture
  view: (composition) =>
    composition === 'ame-street'
      ? { x0: 7380, y0: 270, w: 330, people: [], rain: true }
      : composition === 'ame-eave'
        ? { x0: SPOTS.kisuke.x - 170, y0: 250, w: 340, people: [{ id: 'kisuke-teapot', ...SPOTS.kisuke }], rain: true }
        : null,
  nearbyRank: 50,
  // in the rain; the umbrellas not yet given, nearest first
  nearby: (c) => {
    const out: Nearby[] = [];
    if (c.rainOpen && c.questState('ame') !== 'complete') {
      const wet = c.rain;
      const left = [1, 2, 3].filter((n) => !c.hasFlag(`ame_${n}`)).map((n) => `h-ame${n}`);
      const here = c.here;
      if (here !== undefined) left.sort((a, b) => Math.abs(c.xOf(a) - here) - Math.abs(c.xOf(b) - here));
      if (c.hasFlag('ame_go') && left.length === 0) out.push({ id: 'ame-done', text: '傘を三本とも渡した。茶店の喜助に知らせる', spotId: 'h-kisuke' });
      else if (c.hasFlag('ame_go')) out.push({ id: 'ame-give', text: wet ? `軒下で雨宿りしている人に、傘を届ける（あと${left.length}本）` : '雨の日に、残りの傘を届けに回る（上の「晴」を「雨」に）', spotId: wet ? left[0] : 'h-kisuke', later: !wet });
      else if (wet) out.push({ id: 'ame', text: '雨の茶店で、喜助が貸し傘を数えている', spotId: 'h-kisuke' });
      else out.push({ id: 'ame', text: '雨の日の茶店で、喜助が何か頼みたそうにしている（上の「晴」を「雨」に）', spotId: 'h-kisuke', later: true });
    }
    return out;
  },
};
