import type { Condition, QuestDef } from '../../contract';
import type { DialogueNode } from '../types';
import type { Nearby, StoryModule } from './types';

// 十頁目：ご隠居の散歩 (owner: 多开发内容; demo feedback 「人不能动」). The old man whose towel
// came back asks to walk to the riverside bench his late wife loved. He follows the view at his
// own slow pace (scene/Street.tsx companion): go ahead too fast and he is left behind.

const fictionChar = () => ({ evidenceType: 'fiction' as const, sourceRefs: [], reviewStatus: 'reviewed' as const, knowledgeIds: [], isChild: false });
/** ご隠居の散歩: walking with the player, then arrived at the riverside bench (until the page is made). */
const inkyoWalking: Condition = { all: [{ flag: 'inkyo_walk' }, { not: { flag: 'inkyo_arrived' } }, { not: { quest: 'inkyo', is: 'complete' } }] };
const inkyoAtBench: Condition = { all: [{ flag: 'inkyo_arrived' }, { not: { quest: 'inkyo', is: 'complete' } }] };
/** Where the walk with ご隠居 starts (his road at noon) and ends (beside the bench under the big willow). */
export const INKYO_WALK = { from: 2300, y: 606 };
export const INKYO_BENCH = { x: 545, y: 600 };
/** On the way he stops twice, and says a word (scene x where he stops). */
export const INKYO_STOPS: { x: number; say: string }[] = [
  { x: 1950, say: 'ご隠居が梅の前で足を止めた。「ほころんできたな。あれは、この梅が咲くのを毎年待っておった」' },
  { x: 1150, say: 'ご隠居が池をのぞきこんだ。「ここの鯉に麩をやるのが、あれの楽しみでな」' },
];

const quest: QuestDef = {
  // 十頁目：ご隠居の散歩. Walk with the old man to the riverside bench, at his pace. No money.
  id: 'inkyo',
  prerequisites: [{ quest: 'tenugui', is: 'complete' }],
  steps: [
    { id: 'walk', doneWhen: { flag: 'inkyo_walk' } },
    { id: 'arrive', doneWhen: { flag: 'inkyo_arrived' } },
    { id: 'stay', doneWhen: { any: [{ flag: 'inkyo_listen' }, { flag: 'inkyo_quiet' }] } },
  ],
  completionEffects: [
    { type: 'familiarity', characterId: 'inkyo', eventId: 'inkyo' },
    { type: 'questState', quest: 'inkyo', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const nodes: Record<string, DialogueNode> = {
  'inkyo.ask': {
    effects: [{ type: 'questState', quest: 'inkyo', state: 'discovered' }],
    lines: [
      { by: 'inkyo', text: 'おや、あんたは……手拭いを見つけてくれた、絵師の見習いさんか。' },
      { by: 'inkyo', text: 'あれが染めた手拭いが戻ってから、あれの好きだった場所へ行きたくなってな。町はずれの川端に、古い縁台がある。' },
      { by: 'inkyo', text: 'だが、この足だ。……すまんが、ゆっくり付き合ってくれんか。' },
    ],
    choices: [
      { label: 'いっしょに歩く', next: 'inkyo.go' },
      { label: 'またにする', next: 'inkyo.later' },
    ],
  },
  'inkyo.later': {
    effects: [{ type: 'setFlag', flag: 'inkyo_declined' }],
    lines: [{ by: 'inkyo', text: 'そうか。昼はたいてい、このあたりを歩いておる。' }],
  },
  'inkyo.go': {
    effects: [{ type: 'setFlag', flag: 'inkyo_walk' }, { type: 'questState', quest: 'inkyo', state: 'active' }],
    recallNext: 'inkyo.arrive',
    lines: [{ by: 'narration', text: 'ご隠居は杖をついて、ゆっくり歩きだした。町はずれの川端へ、歩みを合わせて進もう。' }],
  },
  'inkyo.walking': {
    brief: true,
    lines: [{ by: 'narration', text: 'ご隠居「なに、ゆっくりでいい。わしの足に合わせてくれて、ありがたいよ」' }],
  },
  'inkyo.arrive': {
    cg: 'inkyo',
    lines: [
      { by: 'inkyo', text: '着いた着いた。……ああ、ここだ。' },
      { by: 'narration', text: 'ご隠居は縁台のそばに立って、杖に両手をのせた。川風が、柳の枝を揺らしている。' },
      { by: 'inkyo', text: 'あれとは、ここで川を見ながら、何も話さずに座っておったものだ。' },
    ],
    choices: [
      { label: 'おかみさんの話を聞く', next: 'inkyo.listen' },
      { label: '黙って、いっしょに川を見る', next: 'inkyo.quiet' },
    ],
  },
  'inkyo.listen': {
    cg: 'inkyo',
    effects: [{ type: 'setFlag', flag: 'inkyo_listen' }, ...quest.completionEffects],
    page: { pageId: 'p10-inkyo', compositionId: 'inkyo-listen' },
    lines: [
      { by: 'inkyo', text: 'あれは紺屋の娘でな。手拭いを染めるたびに、濃すぎた、薄すぎたと、ここでわしに見せたもんだ。' },
      { by: 'narration', text: '話を聞きながら、ご隠居の横顔と縁台を描いた。' },
      { by: 'inkyo', text: '……長話をしたな。ありがとうよ。帰りは一人で歩ける。' },
      { by: 'narration', text: '絵巻帳に、十頁目が残った。' },
    ],
  },
  'inkyo.quiet': {
    cg: 'inkyo',
    effects: [{ type: 'setFlag', flag: 'inkyo_quiet' }, ...quest.completionEffects],
    page: { pageId: 'p10-inkyo', compositionId: 'inkyo-quiet' },
    lines: [
      { by: 'narration', text: '何も言わずに、並んで川を見た。柳の枝が、ときどき水面にふれる。' },
      { by: 'inkyo', text: '……あれといたときも、こうだった。ありがとうよ。' },
      { by: 'narration', text: '大きな柳と縁台と、ご隠居の背中を描いた。絵巻帳に、十頁目が残った。' },
    ],
  },
};

export const inkyo: StoryModule = {
  quest,
  nodes,
  characters: [
    { ...fictionChar(), id: 'inkyo', sceneId: 'nihonbashi-kita', displayName: 'ご隠居', scriptId: 'inkyo' },
  ],
  roles: { inkyo: '茶店の常連、手拭いの持ち主' },
  hotspots: [
  // ご隠居の散歩: the elder passer-by (noon) once his towel is back; then walking with the player; then at the bench
  { id: 'h-inkyo', targetId: 'inkyo', kind: 'character', anchor: { x: 2300, y: 565 }, hitArea: { x: 2280, y: 535, w: 40, h: 75 }, priority: 6, walker: 'crowd2-elder', visibleWhen: { all: [{ rain: false }, { quest: 'tenugui', is: 'complete' }, { time: 'noon' }, { not: { flag: 'inkyo_walk' } }, { not: { quest: 'inkyo', is: 'complete' } }] } },
  { id: 'h-inkyo-walk', targetId: 'inkyo', kind: 'character', anchor: { x: 2300, y: 565 }, hitArea: { x: 2280, y: 535, w: 40, h: 75 }, priority: 6, walker: 'inkyo-walk', visibleWhen: inkyoWalking },
  { id: 'h-inkyo-bench', targetId: 'inkyo', kind: 'character', anchor: { x: INKYO_BENCH.x, y: INKYO_BENCH.y - 38 }, hitArea: { x: INKYO_BENCH.x - 20, y: INKYO_BENCH.y - 75, w: 40, h: 75 }, priority: 6, visibleWhen: inkyoAtBench },
  ],
  pages: [
    { id: 'p10-inkyo', triggerId: 'inkyo', compositionId: 'inkyo-{listen|quiet}', captionId: 'inkyo', sourceRefs: [] },
    { id: 'p10-inkyo-b', triggerId: 'inkyo', compositionId: 'inkyo-{listen|quiet}', captionId: 'inkyo', sourceRefs: [] },
  ],
  titles: {
    'p10-inkyo': 'ご隠居の散歩',
    'p10-inkyo-b': 'ご隠居の散歩（もう一枚）',
  },
  recallStart: 'inkyo.ask',
  place: {
    'inkyo-listen': '日本橋・昼　町はずれの川端の縁台',
    'inkyo-quiet': '日本橋・昼　町はずれの川端の縁台',
  },
  comment: {
    'inkyo-listen': '人の話を聞きながら描くと、線がやわらかくなる。ご隠居の顔に出ている。',
    'inkyo-quiet': '黙って並ぶのも、付き合いのうちだ。柳と背中だけで、二人の時間が描けている。',
  },
  recallNote: 'もう一つの過ごし方を選べば、別の頁が残ります。',
  entries: {
    inkyo: [
      { rank: 100, when: { all: [{ flag: 'inkyo_arrived' }, { not: { quest: 'inkyo', is: 'complete' } }] }, node: 'inkyo.arrive' },
      { rank: 101, when: { all: [{ flag: 'inkyo_walk' }, { not: { quest: 'inkyo', is: 'complete' } }] }, node: 'inkyo.walking' },
      { rank: 102, node: 'inkyo.ask' },
    ],
  },
  valid: (pageId, compositionId) => (pageId === 'p10-inkyo' || pageId === 'p10-inkyo-b' ? compositionId === 'inkyo-listen' || compositionId === 'inkyo-quiet' : null),
  // ご隠居 is the elder passer-by (crowd2-elder), beside the bench
  view: (composition) =>
    composition === 'inkyo-listen'
      ? { x0: 400, y0: 300, w: 300, people: [{ id: 'crowd2-elder', ...INKYO_BENCH }] }
      : composition === 'inkyo-quiet'
        ? { x0: 250, y0: 120, w: 450, people: [{ id: 'crowd2-elder', ...INKYO_BENCH }] }
        : null,
  nearbyRank: 70,
  // at noon, the old man of the towel; then the bench he is walking to
  nearby: (c) => {
    const out: Nearby[] = [];
    if (c.questState('tenugui') === 'complete' && c.questState('inkyo') !== 'complete') {
      if (c.hasFlag('inkyo_arrived')) out.push({ id: 'inkyo-bench', text: 'ご隠居と、川端の縁台に着いた', spotId: 'h-inkyo-bench' });
      else if (c.hasFlag('inkyo_walk')) out.push({ id: 'inkyo-walk', text: '町はずれの川端の縁台へ。ご隠居は、ゆっくりついてくる（急ぐと置いていってしまう）', spotId: 'a-bench' });
      else if (c.time === 'noon') out.push({ id: 'inkyo', text: '杖をついたご隠居が、町はずれのほうを眺めている', spotId: 'h-inkyo' });
      else out.push({ id: 'inkyo', text: '昼の通りで、手拭いのご隠居が何か言いたそうにしていた（上の時刻で「昼」に）', spotId: 'a-flowers', later: true });
    }
    return out;
  },
};
