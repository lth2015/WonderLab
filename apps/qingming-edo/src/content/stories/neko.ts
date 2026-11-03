import type { QuestDef } from '../../contract';
import { SPOTS } from '../spots';
import type { DialogueNode } from '../types';
import type { Nearby, StoryModule } from './types';

// 九頁目：茶店の猫 (owner: 多开发内容; demo feedback 「交互太少、人不能动」). 喜助's cat is out:
// tapped, it leaps away to the next place (a brief note, so the leap is seen); at the moat it
// stays only if the player waits beside it rather than reaching for it.

/** 茶店の猫: on the well's rim, by the rice bales, on the moat steps; then asleep by the tea house. */
export type NekoAt = 1 | 2 | 3 | 'home';
export const NEKO_AT: Record<NekoAt, { id: string; x: number; y: number; flip?: boolean }> = {
  1: { id: 'neko-sit', x: 10610, y: 437 },
  2: { id: 'neko-loaf', x: 7640, y: 472 },
  3: { id: 'neko-sit', x: 5468, y: 484 }, // on the stone landing, looking at the boat
  home: { id: 'neko-loaf', x: 11700, y: 548 },
};

const quest: QuestDef = {
  // 九頁目：茶店の猫. Follow 喜助's cat along the roll; at the moat, wait beside it.
  id: 'neko',
  prerequisites: [{ quest: 'tenugui', is: 'complete' }],
  steps: [
    { id: 'look', doneWhen: { flag: 'neko_look' } },
    { id: 'follow', doneWhen: { all: [{ flag: 'neko_hop1' }, { flag: 'neko_hop2' }] } },
    { id: 'wait', doneWhen: { flag: 'neko_caught' } },
    { id: 'home', doneWhen: { any: [{ flag: 'neko_bench' }, { flag: 'neko_boat' }] } },
  ],
  completionEffects: [
    { type: 'grant', rewardId: 'neko', amountMinor: 10 },
    { type: 'familiarity', characterId: 'kisuke', eventId: 'neko' },
    { type: 'questState', quest: 'neko', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const HOP = (flag: string, text: string): DialogueNode => ({ brief: true, effects: [{ type: 'setFlag', flag }], lines: [{ by: 'narration', text }] });
const nodes: Record<string, DialogueNode> = {
  'kisuke.neko.ask': {
    effects: [{ type: 'questState', quest: 'neko', state: 'discovered' }],
    lines: [
      { by: 'kisuke', text: 'うちの三毛の「こはく」が、朝から帰ってこないんだ。いつもは縁台の下で寝てるんだがね。' },
      { by: 'kisuke', text: '猫は追うと逃げる。見かけたら、急がずに連れて帰ってきてくれないか。' },
    ],
    choices: [
      { label: '探してみる', next: 'kisuke.neko.go' },
      { label: 'またにする', next: 'kisuke.neko.later' },
    ],
  },
  'kisuke.neko.later': {
    effects: [{ type: 'setFlag', flag: 'neko_declined' }],
    lines: [{ by: 'kisuke', text: 'いいさ。腹がへれば、そのうち帰ってくるだろう。' }],
  },
  'kisuke.neko.go': {
    effects: [{ type: 'setFlag', flag: 'neko_look' }, { type: 'questState', quest: 'neko', state: 'active' }],
    recallNext: 'neko.found',
    lines: [{ by: 'narration', text: '小路の井戸のほうから、猫の鳴き声が聞こえた気がする。' }],
  },
  'kisuke.neko.waiting': {
    lines: [{ by: 'kisuke', text: 'こはくは、高いところと、水の見えるところが好きなんだ。' }],
  },
  'neko.hop1': HOP('neko_hop1', '井戸のふちに三毛猫がいた。手を伸ばすと、ひらりと跳んで、米屋のほうへ駆けていった。'),
  'neko.hop2': HOP('neko_hop2', '米俵の前で丸くなっていたこはくが、ぱっと起きて、堀の河岸のほうへ駆けていった。'),
  'neko.found': {
    lines: [{ by: 'narration', text: '堀の河岸の石段で、こはくがじっと舟を見ている。今度は逃げる気配がない。' }],
    choices: [
      { label: 'そっと手を伸ばす', next: 'neko.reach' },
      { label: '隣にしゃがんで、いっしょに舟を見る', next: 'neko.wait' },
    ],
  },
  'neko.reach': {
    lines: [{ by: 'narration', text: 'こはくは耳を伏せて、少し体を引いた。……急ぐと、また逃げてしまいそうだ。' }],
  },
  'neko.wait': {
    effects: [{ type: 'setFlag', flag: 'neko_caught' }],
    recallNext: 'kisuke.neko.back',
    lines: [
      { by: 'narration', text: 'しばらく並んで舟を見ていた。荷を積んだ舟が一艘、ゆっくり堀を下っていく。' },
      { by: 'narration', text: 'ふいに、こはくのほうから膝に乗ってきた。あたたかい。茶店へ連れて帰ろう。' },
    ],
  },
  'kisuke.neko.back': {
    lines: [
      { by: 'kisuke', text: 'こはく！ ……まったく、心配させて。' },
      { by: 'kisuke', text: '堀で舟を見ていた？ そうか。こいつは子猫のころ、船宿にいたんだ。ときどき、舟が恋しくなるのかもしれないな。' },
    ],
    choices: [
      { label: '茶店の前で眠るこはくを描く', next: 'neko.bench' },
      { label: '舟を見ていたこはくを描く', next: 'neko.boat' },
    ],
  },
  'neko.bench': {
    effects: [{ type: 'setFlag', flag: 'neko_bench' }, ...quest.completionEffects],
    page: { pageId: 'p09-neko', compositionId: 'neko-bench' },
    lines: [
      { by: 'narration', text: '茶店の前の日なたで、こはくはもう丸くなって眠っている。その寝息まで描くつもりで、筆を運んだ。' },
      { by: 'kisuke', text: 'ありがとうよ。少ないが、取っておいてくれ。' },
      { by: 'narration', text: '十文を受け取った。絵巻帳に、九頁目が残った。', reward: true },
    ],
  },
  'neko.boat': {
    effects: [{ type: 'setFlag', flag: 'neko_boat' }, ...quest.completionEffects],
    page: { pageId: 'p09-neko', compositionId: 'neko-boat' },
    lines: [
      { by: 'narration', text: '思い出しながら描いた。石段の上の小さな背中と、その先の舟と、堀の水。' },
      { by: 'kisuke', text: 'ありがとうよ。少ないが、取っておいてくれ。' },
      { by: 'narration', text: '十文を受け取った。絵巻帳に、九頁目が残った。', reward: true },
    ],
  },
  'neko.home': {
    lines: [{ by: 'narration', text: 'こはくが茶店の前で丸くなっている。しっぽの先だけが、ときどき動く。' }],
  },
};

export const neko: StoryModule = {
  quest,
  nodes,
  hotspots: [
  // 茶店の猫: 喜助's cat, at one place at a time while it is looked for, then home by the tea house
  { id: 'h-neko1', targetId: 'neko1', kind: 'prop', anchor: { x: 10610, y: 424 }, hitArea: { x: 10580, y: 400, w: 60, h: 44 }, priority: 7, visibleWhen: { all: [{ flag: 'neko_look' }, { not: { flag: 'neko_hop1' } }, { not: { quest: 'neko', is: 'complete' } }] } },
  { id: 'h-neko2', targetId: 'neko2', kind: 'prop', anchor: { x: 7640, y: 465 }, hitArea: { x: 7610, y: 446, w: 60, h: 34 }, priority: 7, visibleWhen: { all: [{ flag: 'neko_hop1' }, { not: { flag: 'neko_hop2' } }, { not: { quest: 'neko', is: 'complete' } }] } },
  { id: 'h-neko3', targetId: 'neko3', kind: 'prop', anchor: { x: 5468, y: 471 }, hitArea: { x: 5438, y: 446, w: 60, h: 44 }, priority: 7, visibleWhen: { all: [{ flag: 'neko_hop2' }, { not: { flag: 'neko_caught' } }, { not: { quest: 'neko', is: 'complete' } }] } },
  { id: 'h-nekohome', targetId: 'nekohome', kind: 'prop', anchor: { x: 11700, y: 542 }, hitArea: { x: 11678, y: 528, w: 46, h: 26 }, priority: 4, visibleWhen: { quest: 'neko', is: 'complete' } },
  ],
  pages: [
    { id: 'p09-neko', triggerId: 'neko', compositionId: 'neko-{bench|boat}', captionId: 'neko', sourceRefs: [] },
    { id: 'p09-neko-b', triggerId: 'neko', compositionId: 'neko-{bench|boat}', captionId: 'neko', sourceRefs: [] },
  ],
  titles: {
    'p09-neko': '茶店の猫',
    'p09-neko-b': '茶店の猫（もう一枚）',
  },
  recallStart: 'kisuke.neko.ask',
  place: {
    'neko-bench': '日本橋　茶店「喜の字」の前',
    'neko-boat': '日本橋　堀の河岸の石段',
  },
  comment: {
    'neko-bench': '眠る猫ほど、描くのは難しい。寝息のやわらかさが出ている。',
    'neko-boat': '猫が見ていたものを、お前も並んで見たな。舟の揺れまで描けている。',
  },
  recallNote: 'もう一つの場面を描けば、別の頁が残ります。',
  entries: {
    // the cat brought back, then still looking, then the ask (on a later visit, once his thanks for the towel has been heard)
    kisuke: [
      { rank: 300, when: { all: [{ flag: 'neko_caught' }, { not: { quest: 'neko', is: 'complete' } }] }, node: 'kisuke.neko.back' },
      { rank: 301, when: { all: [{ flag: 'neko_look' }, { not: { quest: 'neko', is: 'complete' } }] }, node: 'kisuke.neko.waiting' },
      { rank: 302, when: { all: [{ flag: 'kisuke_seen_done' }, { not: { quest: 'neko', is: 'complete' } }] }, node: 'kisuke.neko.ask' },
    ],
    neko1: [
      { rank: 100, node: 'neko.hop1' },
    ],
    neko2: [
      { rank: 100, node: 'neko.hop2' },
    ],
    neko3: [
      { rank: 100, node: 'neko.found' },
    ],
    nekohome: [
      { rank: 100, node: 'neko.home' },
    ],
  },
  atTime: {
    'neko.home': {
      morning: { by: 'narration', text: 'こはくが茶店の前で、朝の日なたぼっこをしている。' },
      evening: { by: 'narration', text: 'こはくが堀のほうを向いて座っている。舟の帰りを待っているのかもしれない。' },
    },
  },
  valid: (pageId, compositionId) => (pageId === 'p09-neko' || pageId === 'p09-neko-b' ? compositionId === 'neko-bench' || compositionId === 'neko-boat' : null),
  view: (composition) =>
    composition === 'neko-bench'
      ? {
          x0: SPOTS.kisuke.x - 170,
          y0: 250,
          w: 340,
          people: [{ id: 'kisuke-pour', ...SPOTS.kisuke }, { ...NEKO_AT.home }],
        }
      : composition === 'neko-boat'
        ? { x0: 5330, y0: 300, w: 270, people: [{ ...NEKO_AT[3] }] }
        : null,
  nearbyRank: 80,
  // where the cat went last (the hint says which way it ran)
  nearby: (c) => {
    const out: Nearby[] = [];
    if (c.hasFlag('kisuke_seen_done') && c.questState('neko') !== 'complete') {
      if (c.hasFlag('neko_caught')) out.push({ id: 'neko-back', text: 'こはくを、茶店の喜助のところへ連れて帰る', spotId: 'h-kisuke' });
      else if (c.hasFlag('neko_hop2')) out.push({ id: 'neko-3', text: '三毛猫は、堀の河岸のほうへ駆けていった', spotId: 'h-neko3' });
      else if (c.hasFlag('neko_hop1')) out.push({ id: 'neko-2', text: '三毛猫は、米屋のほうへ駆けていった', spotId: 'h-neko2' });
      else if (c.hasFlag('neko_look')) out.push({ id: 'neko-1', text: '喜助の三毛猫を探す。井戸のほうで、鳴き声がした', spotId: 'h-neko1' });
      else out.push({ id: 'neko', text: '茶店の喜助が、縁台の下をのぞきこんでいる', spotId: 'h-kisuke' });
    }
    return out;
  },
};
