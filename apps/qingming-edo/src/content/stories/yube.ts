import type { Condition, QuestDef } from '../../contract';
import { SPOTS } from '../spots';
import type { DialogueNode } from '../types';
import type { Nearby, StoryModule } from './types';

// 六頁目：夕暮れの灯. Only in the evening: carry the flame and light three lamps along the street.

const lampToLight = (n: number): Condition => ({ all: [{ flag: 'yube_fire' }, { time: 'evening' }, { not: { flag: `yube_lit${n}` } }] });

const quest: QuestDef = {
  // 六頁目：夕暮れの灯. In the evening only: walk the street lighting three lamps.
  id: 'yube',
  prerequisites: [{ quest: 'dougu', is: 'complete' }, { quest: 'tenugui', is: 'complete' }],
  steps: [
    { id: 'fire', doneWhen: { flag: 'yube_fire' } },
    { id: 'light', doneWhen: { all: [{ flag: 'yube_lit1' }, { flag: 'yube_lit2' }, { flag: 'yube_lit3' }] } },
    { id: 'end', doneWhen: { any: [{ flag: 'yube_tell' }, { flag: 'yube_watch' }] } },
  ],
  completionEffects: [
    { type: 'grant', rewardId: 'yube', amountMinor: 14 },
    { type: 'familiarity', characterId: 'kisuke', eventId: 'yube' },
    { type: 'questState', quest: 'yube', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const LIGHT = (n: number, place: string): DialogueNode => ({
  effects: [{ type: 'setFlag', flag: `yube_lit${n}` }],
  lines: [
    { by: 'narration', text: '火種を寄せると、紙の中に小さな火がゆらりと立った。' },
    { by: 'narration', text: place },
  ],
});
const nodes: Record<string, DialogueNode> = {
  'kisuke.yube.ask': {
    effects: [{ type: 'questState', quest: 'yube', state: 'discovered' }],
    lines: [
      { by: 'kisuke', text: 'おや、もう夕方か。……困ったね。灯をともして回る作爺さんが、今朝腰を痛めちまって。' },
      { by: 'kisuke', text: '橋のたもとの石灯籠、米屋の前、堀の桟橋。あの三つに火がないと、帰りの人が足元に困る。' },
      { by: 'kisuke', text: 'この火種を持って、点けて回ってくれないかい。' },
    ],
    choices: [
      { label: '点けて回る', next: 'kisuke.yube.fire' },
      { label: 'また後で', next: 'kisuke.yube.later' },
    ],
  },
  'kisuke.yube.later': {
    effects: [{ type: 'setFlag', flag: 'yube_declined' }],
    lines: [{ by: 'kisuke', text: 'そうかい。日が落ちきる前に、気が向いたら頼むよ。' }],
  },
  'kisuke.yube.fire': {
    effects: [{ type: 'setFlag', flag: 'yube_fire' }, { type: 'questState', quest: 'yube', state: 'active' }],
    recallNext: 'kisuke.yube.done',
    lines: [
      { by: 'kisuke', text: '風に気をつけてな。灯ってのは、点けて回る順番なんかどうでもいい。全部に火が入ればいいのさ。' },
      { by: 'narration', text: '小さな火種を受け取った。通りは、もう夕方の色だ。' },
    ],
  },
  'kisuke.yube.waiting': {
    lines: [{ by: 'kisuke', text: '石灯籠と、米屋の前と、堀の桟橋だよ。暗くなる前に頼む。' }],
  },
  'yube.light1': LIGHT(1, '橋を渡ってくる人の足元が、ほんのり明るくなった。'),
  'yube.light2': LIGHT(2, '米屋の前を、天秤棒の影がひとつ、灯の下を通り過ぎていく。'),
  'yube.light3': LIGHT(3, '桟橋の水面に、灯がひとつ揺れて映った。'),
  'kisuke.yube.done': {
    lines: [
      { by: 'kisuke', text: '三つとも点けてくれたかい。……ほら、ここからでも橋の灯が見える。' },
      { by: 'kisuke', text: '作爺さんはね、毎晩あれを点けて回って、もう三十年になる。' },
    ],
    choices: [
      { label: '作爺さんに知らせに行く', next: 'yube.tell' },
      { label: 'ここで灯を眺めていく', next: 'yube.watch' },
    ],
  },
  'yube.tell': {
    effects: [{ type: 'setFlag', flag: 'yube_tell' }, ...quest.completionEffects],
    page: { pageId: 'p06-yube', compositionId: 'yube-tell' },
    lines: [
      { by: 'narration', text: '茶店の裏の長屋で、作爺さんは布団の上から身を起こした。' },
      { by: 'narration', text: '「そうかい、三つとも点けてくれたかい」と、作爺さんは何度もうなずいた。' },
      { by: 'kisuke', text: '作爺さんから、これを渡してくれって。手間賃だそうだ。', reward: true },
      { by: 'narration', text: '十四文を受け取った。絵巻帳に、六頁目が残った。', reward: true },
    ],
  },
  'yube.watch': {
    effects: [{ type: 'setFlag', flag: 'yube_watch' }, ...quest.completionEffects],
    page: { pageId: 'p06-yube', compositionId: 'yube-watch' },
    lines: [
      { by: 'narration', text: '喜助が、湯気の立つ茶を縁台に置いた。通りの灯が、ひとつずつ遠くまで続いている。' },
      { by: 'kisuke', text: '灯ってのは、点けた人には見えないもんだと、作爺さんがよく言ってた。……今夜は、あんたが見る番だ。' },
      { by: 'kisuke', text: 'これは作爺さんの分の手間賃だ。取っといてくれ。', reward: true },
      { by: 'narration', text: '十四文を受け取った。絵巻帳に、六頁目が残った。', reward: true },
    ],
  },
  'kisuke.yube.after': {
    lines: [{ by: 'kisuke', text: '今夜も灯が入ってるね。作爺さんも、もうじき起きられるそうだ。' }],
  },
};

export const yube: StoryModule = {
  quest,
  nodes,
  labels: { lamp1: '橋のたもとの石灯籠', lamp2: '米屋のそばの提灯', lamp3: '堀の河岸の提灯' },
  hotspots: [
    // the stone lantern by the bridge, and two street lamps (scene/painted.tsx STREET_LAMPS)
    { id: 'h-lamp1', targetId: 'lamp1', kind: 'prop', anchor: { x: 12745, y: 400 }, hitArea: { x: 12722, y: 350, w: 46, h: 110 }, priority: 8, visibleWhen: lampToLight(1) },
    { id: 'h-lamp2', targetId: 'lamp2', kind: 'prop', anchor: { x: 7790, y: 560 }, hitArea: { x: 7774, y: 520, w: 32, h: 84 }, priority: 8, visibleWhen: lampToLight(2) },
    { id: 'h-lamp3', targetId: 'lamp3', kind: 'prop', anchor: { x: 5480, y: 480 }, hitArea: { x: 5464, y: 440, w: 32, h: 84 }, priority: 8, visibleWhen: lampToLight(3) },
  ],
  pages: [
    { id: 'p06-yube', triggerId: 'yube', compositionId: 'yube-{tell|watch}', captionId: 'yube', sourceRefs: [] },
    { id: 'p06-yube-b', triggerId: 'yube', compositionId: 'yube-{tell|watch}', captionId: 'yube', sourceRefs: [] },
  ],
  titles: {
    'p06-yube': '夕暮れの灯',
    'p06-yube-b': '夕暮れの灯（もう一つの宵）',
  },
  recallStart: 'kisuke.yube.ask',
  entries: {
    // evening only; his other words at other times
    kisuke: [
      { rank: 200, when: { all: [{ quest: 'yube', is: 'complete' }, { time: 'evening' }] }, node: 'kisuke.yube.after' },
      { rank: 201, when: { all: [{ flag: 'yube_lit1' }, { flag: 'yube_lit2' }, { flag: 'yube_lit3' }, { not: { quest: 'yube', is: 'complete' } }] }, node: 'kisuke.yube.done' },
      { rank: 202, when: { all: [{ flag: 'yube_fire' }, { not: { quest: 'yube', is: 'complete' } }] }, node: 'kisuke.yube.waiting' },
      { rank: 203, when: { all: [{ time: 'evening' }, { quest: 'dougu', is: 'complete' }, { quest: 'tenugui', is: 'complete' }, { not: { quest: 'yube', is: 'complete' } }] }, node: 'kisuke.yube.ask' },
    ],
    lamp1: [{ rank: 100, node: 'yube.light1' }],
    lamp2: [{ rank: 100, node: 'yube.light2' }],
    lamp3: [{ rank: 100, node: 'yube.light3' }],
  },
  place: {
    'yube-tell': '日本橋・夕　橋のたもとの石灯籠',
    'yube-watch': '日本橋・夕　茶店「喜の字」の縁台',
  },
  comment: {
    'yube-tell': '灯を点けた手で、点けられなかった人を訪ねた。そこまで描けている。',
    'yube-watch': '自分の点けた灯を、ゆっくり眺めたな。夕方の色が、よく出ている。',
  },
  recallNote: 'もう一つの宵の過ごし方を選べば、別の頁が残ります。',
  valid: (pageId, compositionId) => (pageId === 'p06-yube' || pageId === 'p06-yube-b' ? compositionId === 'yube-tell' || compositionId === 'yube-watch' : null),
  // always an evening page, with the lamps lit
  view: (composition) =>
    composition === 'yube-tell'
      ? { x0: 12560, y0: 250, w: 360, people: [{ id: 'sokichi-nod', ...SPOTS.sokichi }], tod: 'evening', lamps: true }
      : composition === 'yube-watch'
        ? { x0: SPOTS.kisuke.x - 170, y0: 250, w: 340, people: [{ id: 'kisuke-pour', ...SPOTS.kisuke }], tod: 'evening', lamps: true }
        : null,
  nearbyRank: 20,
  // in the evening; then the lamps not yet lit, nearest first
  nearby: (c) => {
    const out: Nearby[] = [];
    const yube = c.questState('yube');
    const evening = c.time === 'evening';
    if (yube !== 'complete' && c.questState('dougu') === 'complete' && c.questState('tenugui') === 'complete') {
      const left = [1, 2, 3].filter((n) => !c.hasFlag(`yube_lit${n}`));
      if (c.hasFlag('yube_fire') && left.length === 0) out.push({ id: 'yube-done', text: '三つの灯がともった。茶店の喜助に知らせる', spotId: 'h-kisuke' });
      else if (c.hasFlag('yube_fire')) out.push({ id: 'yube-light', text: evening ? `提灯に火を入れて回る（あと${left.length}つ）` : '夕方になったら、提灯に火を入れて回る', spotId: evening ? `h-lamp${left[0]}` : 'h-kisuke', later: !evening });
      else if (evening) out.push({ id: 'yube', text: '茶店の喜助が、暗くなる通りを気にしている', spotId: 'h-kisuke' });
      else out.push({ id: 'yube', text: '夕方の茶店で、喜助が何か頼みたそうにしている（上の時刻で「夕」に）', spotId: 'h-kisuke', later: true });
    }
    return out;
  },
};
