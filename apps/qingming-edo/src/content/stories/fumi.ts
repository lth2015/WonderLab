import type { Condition, QuestDef } from '../../contract';
import type { DialogueNode } from '../types';
import type { Nearby, StoryModule } from './types';

// 五頁目：母への文. A new way to take part: catch a man walking down the street.

const fictionChar = () => ({ evidenceType: 'fiction' as const, sourceRefs: [], reviewStatus: 'reviewed' as const, knowledgeIds: [], isChild: false });
const letterOnRoad: Condition = { all: [{ quest: 'kaze', is: 'complete' }, { not: { flag: 'fumi_carry' } }, { not: { quest: 'fumi', is: 'complete' } }] };
const iheiMet: Condition = { any: [{ flag: 'fumi_carry' }, { quest: 'fumi', is: 'complete' }] };

const quest: QuestDef = {
  // 五頁目：母への文. Catch a walking man to return his letter; either word completes it.
  id: 'fumi',
  prerequisites: [{ quest: 'kaze', is: 'complete' }],
  steps: [
    { id: 'pick', doneWhen: { flag: 'fumi_carry' } },
    { id: 'return', doneWhen: { any: [{ flag: 'fumi_send' }, { flag: 'fumi_rewrite' }] } },
  ],
  completionEffects: [
    { type: 'grant', rewardId: 'fumi', amountMinor: 16 },
    { type: 'familiarity', characterId: 'ihei', eventId: 'fumi' },
    { type: 'questState', quest: 'fumi', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const nodes: Record<string, DialogueNode> = {
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
    effects: [{ type: 'setFlag', flag: 'fumi_send' }, ...quest.completionEffects],
    page: { pageId: 'p05-fumi', compositionId: 'fumi-send' },
    lines: [
      { by: 'ihei', text: '……そうだな。隠したところで、母にはわかる。そういう人だ。' },
      { by: 'ihei', text: '今日のうちに飛脚に頼もう。拾ってくれて、ありがとう。これは礼だ。', reward: true },
      { by: 'narration', text: '十六文を受け取った。絵巻帳に、五頁目が残った。', reward: true },
    ],
  },
  'ihei.rewrite': {
    effects: [{ type: 'setFlag', flag: 'fumi_rewrite' }, ...quest.completionEffects],
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
};

export const fumi: StoryModule = {
  quest,
  nodes,
  characters: [
    { ...fictionChar(), id: 'ihei', sceneId: 'nihonbashi-kita', displayName: '伊兵衛', scriptId: 'ihei' },
  ],
  roles: { ihei: '両替屋の手代' },
  labels: { fumi: '道に落ちている文' },
  hotspots: [
    // the letter on the road, and 伊兵衛 — a walking passer-by, hit where he is (scene/Street.tsx live)
    { id: 'h-fumi', targetId: 'fumi', kind: 'prop', anchor: { x: 7700, y: 610 }, hitArea: { x: 7684, y: 600, w: 32, h: 18 }, priority: 7, visibleWhen: letterOnRoad },
    { id: 'h-ihei', targetId: 'ihei', kind: 'character', anchor: { x: 8040, y: 565 }, hitArea: { x: 8023, y: 520, w: 34, h: 90 }, priority: 6, visibleWhen: iheiMet, walker: 'crowd1-merchant' },
  ],
  pages: [
    { id: 'p05-fumi', triggerId: 'fumi', compositionId: 'fumi-{send|rewrite}', captionId: 'fumi', sourceRefs: [] },
    { id: 'p05-fumi-b', triggerId: 'fumi', compositionId: 'fumi-{send|rewrite}', captionId: 'fumi', sourceRefs: [] },
  ],
  titles: {
    'p05-fumi': '母への文',
    'p05-fumi-b': '母への文（もう一つの返事）',
  },
  recallStart: 'fumi.found',
  entries: {
    ihei: [
      { rank: 100, when: { flag: 'fumi_send' }, node: 'ihei.done.send' },
      { rank: 101, when: { flag: 'fumi_rewrite' }, node: 'ihei.done.rewrite' },
      { rank: 102, node: 'ihei.receive' },
    ],
    fumi: [
      { rank: 100, node: 'fumi.found' },
    ],
  },
  atTime: {
    'ihei.done.send': {
      morning: { by: 'ihei', text: '今朝、飛脚に渡したよ。足の速そうな男だった。' },
      evening: { by: 'ihei', text: '母から返事が来るのは、早くて十日後だそうだ。待つのも悪くない。' },
    },
    'ihei.done.rewrite': {
      morning: { by: 'ihei', text: '朝のうちに書き直そうと思ってね。……まだ一行目だが。' },
      evening: { by: 'ihei', text: '書き直した文、今夜のうちに封をするよ。柳のことも書いた。' },
    },
  },
  talk: ['ihei.done.send', 'ihei.done.rewrite'],
  place: {
    'fumi-send': '日本橋・朝　米屋の前の往来',
    'fumi-rewrite': '日本橋・朝　米屋の前の往来',
  },
  comment: {
    'fumi-send': '拾った文を、読まずに返した。その手の行儀が、絵に出ている。',
    'fumi-rewrite': '書き直す時間をやったな。人を急かさないのも、町の作法だ。',
  },
  recallNote: 'もう一つの言葉を選べば、別の頁が残ります。',
  valid: (pageId, compositionId) => (pageId === 'p05-fumi' || pageId === 'p05-fumi-b' ? compositionId === 'fumi-send' || compositionId === 'fumi-rewrite' : null),
  view: (composition) =>
    composition === 'fumi-send' || composition === 'fumi-rewrite'
      ? {
          // the clerk with his letter by the rice shop; the rewrite page stands further back
          x0: composition === 'fumi-send' ? 7830 : 7740,
          y0: composition === 'fumi-send' ? 330 : 210,
          w: composition === 'fumi-send' ? 260 : 380,
          people: [{ id: 'crowd1-merchant', x: 7960, y: 610, flip: composition === 'fumi-rewrite' }],
        }
      : null,
  nearbyRank: 30,
  // the letter, then the man walking with his abacus
  nearby: (c) => {
    const out: Nearby[] = [];
    if (c.questState('kaze') === 'complete' && c.questState('fumi') !== 'complete') {
      if (c.hasFlag('fumi_carry')) out.push({ id: 'fumi-carry', text: '文の持ち主に追いつく。そろばんの包みを抱えて歩いている', spotId: 'h-ihei' });
      else out.push({ id: 'fumi', text: '米屋の前の道に、何か落ちている', spotId: 'h-fumi' });
    }
    return out;
  },
};
