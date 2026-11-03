import type { Condition, Effect, QuestDef } from '../../contract';
import { SPOTS } from '../spots';
import type { DialogueNode } from '../types';
import type { StoryModule } from './types';

// 四頁目：河岸の朝 (roadmap #158 item 4). Across the bridge, a new place and a new way
// to take part: look for someone in the painting itself. Either ending completes it.

const fictionChar = () => ({ evidenceType: 'fiction' as const, sourceRefs: [], reviewStatus: 'reviewed' as const, knowledgeIds: [], isChild: false });
// 亀吉 hides by the boats while he is being looked for, then stands by おまつ
const kameHidden: Condition = { all: [{ flag: 'kashi_search' }, { not: { quest: 'kashi', is: 'complete' } }] };
const kameHome: Condition = { quest: 'kashi', is: 'complete' };

const quest: QuestDef = {
  // 四頁目：河岸の朝 (roadmap #158 item 4). Find 亀吉 in the painting; either ending completes it.
  id: 'kashi',
  prerequisites: [{ quest: 'kaze', is: 'complete' }],
  steps: [
    { id: 'search', doneWhen: { flag: 'kashi_search' } },
    { id: 'find', doneWhen: { flag: 'kashi_found' } },
    { id: 'home', doneWhen: { any: [{ flag: 'kashi_now' }, { flag: 'kashi_watched' }] } },
  ],
  completionEffects: [
    { type: 'grant', rewardId: 'kashi', amountMinor: 20 },
    { type: 'familiarity', characterId: 'omatsu', eventId: 'kashi' },
    { type: 'questState', quest: 'kashi', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const KASHI_DONE: Effect[] = [{ type: 'setFlag', flag: 'kashi_found' }];
const nodes: Record<string, DialogueNode> = {
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
    effects: [{ type: 'setFlag', flag: 'kashi_now' }, { type: 'familiarity', characterId: 'kamekichi', eventId: 'kashi' }, ...quest.completionEffects],
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
    effects: [{ type: 'setFlag', flag: 'kashi_watched' }, { type: 'familiarity', characterId: 'kamekichi', eventId: 'kashi' }, ...quest.completionEffects],
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
};

export const kashi: StoryModule = {
  quest,
  characters: [
    { ...fictionChar(), id: 'omatsu', sceneId: 'nihonbashi-kita', displayName: 'おまつ', scriptId: 'omatsu' },
    { ...fictionChar(), isChild: true, id: 'kamekichi', sceneId: 'nihonbashi-kita', displayName: '亀吉', scriptId: 'kamekichi' },
  ],
  roles: {
    omatsu: '河岸の魚売り',
    kamekichi: 'おまつの孫',
  },
  hotspots: [
    // placed on the painted quay (scene/painted.tsx)
    { id: 'h-omatsu', targetId: 'omatsu', kind: 'character', anchor: { x: 14700, y: 412 }, hitArea: { x: 14676, y: 372, w: 48, h: 80 }, priority: 5 },
    { id: 'h-kame-hidden', targetId: 'kamekichi', kind: 'character', anchor: { x: 15482, y: 452 }, hitArea: { x: 15466, y: 436, w: 32, h: 34 }, priority: 6, visibleWhen: kameHidden },
    { id: 'h-kame', targetId: 'kamekichi', kind: 'character', anchor: { x: 14748, y: 426 }, hitArea: { x: 14736, y: 400, w: 26, h: 54 }, priority: 6, visibleWhen: kameHome },
  ],
  pages: [
    { id: 'p04-kashi', triggerId: 'kashi', compositionId: 'kashi-{now|watch}', captionId: 'kashi', sourceRefs: [] },
    { id: 'p04-kashi-b', triggerId: 'kashi', compositionId: 'kashi-{now|watch}', captionId: 'kashi', sourceRefs: [] },
  ],
  titles: {
    'p04-kashi': '河岸の朝',
    'p04-kashi-b': '河岸の朝（もう一つの帰り道）',
  },
  nodes,
  recallStart: 'omatsu.ask',
  entries: {
    omatsu: [
      { rank: 100, when: { flag: 'kashi_watched' }, node: 'omatsu.done.watch' },
      { rank: 101, when: { quest: 'kashi', is: 'complete' }, node: 'omatsu.done' },
      { rank: 102, when: { flag: 'kashi_search' }, node: 'omatsu.searching' },
      { rank: 103, when: { all: [{ quest: 'kaze', is: 'complete' }, { flag: 'kashi_declined' }] }, node: 'omatsu.ask.again' },
      { rank: 104, when: { quest: 'kaze', is: 'complete' }, node: 'omatsu.ask' },
      { rank: 105, node: 'omatsu.first' },
    ],
    kamekichi: [
      { rank: 100, when: { quest: 'kashi', is: 'complete' }, node: 'kame.done' },
      { rank: 101, node: 'kame.found' },
    ],
  },
  atTime: {
    'omatsu.done': {
      morning: { by: 'omatsu', text: 'この時分の河岸がいちばん忙しいよ。亀吉も、舟を手伝うつもりでいる。' },
      evening: { by: 'omatsu', text: '舟がみんな戻ってきた。今日の河岸も、これでおしまいだ。' },
    },
    'kame.done': {
      morning: { by: 'kamekichi', text: '一番舟、もう見たかい？ おいらは見たぞ！' },
      evening: { by: 'kamekichi', text: 'ばあちゃんがもう帰るって。……明日も来るよな？' },
    },
  },
  talk: ['omatsu.done', 'omatsu.done.watch'],
  place: {
    'kashi-now': '日本橋・朝　向こう岸の河岸',
    'kashi-watch': '日本橋・朝　河岸の樽の陰',
  },
  comment: {
    'kashi-now': '見えない目で、声だけで孫を見つける。その顔を、よく描いた。',
    'kashi-watch': '急がずに隣で見ていたな。待つことも、手助けのうちだ。',
  },
  recallNote: 'もう一つの帰り方を選べば、別の頁が残ります。',
  valid: (pageId, compositionId) => (pageId === 'p04-kashi' || pageId === 'p04-kashi-b' ? compositionId === 'kashi-now' || compositionId === 'kashi-watch' : null),
  view: (composition) =>
    composition === 'kashi-now'
      ? {
          x0: SPOTS.omatsu.x - 150,
          y0: 230,
          w: 300,
          people: [
            { id: 'omatsu-smile', ...SPOTS.omatsu },
            { id: 'kame-shy', ...SPOTS.kameHome },
          ],
        }
      : composition === 'kashi-watch'
        ? {
            // the two of them by the barrels, the boats below
            x0: SPOTS.kameHide.x - 210,
            y0: 260,
            w: 330,
            people: [{ id: 'kame-point', ...SPOTS.kameHide }],
          }
        : null,
  nearbyRank: 40,
  // across the bridge. The search hint points at the boats, never at 亀吉 himself.
  nearby: (c) =>
    c.questState('kaze') === 'complete' && c.questState('kashi') !== 'complete'
      ? [
          c.hasFlag('kashi_found')
            ? { id: 'kashi-home', text: '亀吉を、おまつのところへ連れて帰る', spotId: 'h-kame-hidden' }
            : c.hasFlag('kashi_search')
              ? { id: 'kashi-search', text: '亀吉を探す。舟の荷揚げを眺めるのが好きらしい', spotId: 'a-kashi-boats' }
              : { id: 'kashi', text: '橋の向こうの河岸で、おまつが誰かを呼んでいる', spotId: 'h-omatsu' },
        ]
      : [],
};
