import type { Condition, QuestDef } from '../../contract';
import type { DialogueNode, Line } from '../types';
import type { Nearby, StoryModule } from './types';

// 八頁目：橋のたもと (owner: 多开发内容; demo feedback 「剧情太少」). When the four people
// the player helped have their pages, 宗吉 asks for one picture of them all: invite four
// of them along the roll, then everyone gathers by the bridge and the player chooses the picture.

/** 橋のたもと can be asked for once the four people it gathers each have their page. */
const HASHI_READY: Condition = { all: (['dougu', 'tenugui', 'kashi', 'fumi'] as const).map((quest) => ({ quest, is: 'complete' as const })) };
/** 橋のたもと: whom 宗吉 asks the player to invite, and the story that made each a friend. */
const HASHI_PEOPLE = [
  { id: 'okon', name: 'お紺', spot: 'h-okon', quest: 'dougu' },
  { id: 'kisuke', name: '喜助', spot: 'h-kisuke', quest: 'tenugui' },
  { id: 'ihei', name: '伊兵衛', spot: 'h-ihei', quest: 'fumi' },
  { id: 'omatsu', name: 'おまつ', spot: 'h-omatsu', quest: 'kashi' },
] as const;

/**
 * 八頁目 (橋のたもと): everyone the player helped, on the open ground before the bridge,
 * two rows (the back row higher up the road). 宗吉 at the end, if the player asked him in.
 */
function hashiGroup(withMaster: boolean): { id: string; x: number; y: number }[] {
  const back: { id: string; x: number; y: number }[] = [
    { id: 'seita-stand', x: 12720, y: 505 },
    { id: 'okon-bow', x: 12765, y: 507 },
    { id: 'kinji-nod', x: 12818, y: 505 },
    { id: 'oharu-found', x: 12872, y: 507 },
    { id: 'kisuke-teapot', x: 12928, y: 505 },
  ];
  const front: { id: string; x: number; y: number }[] = [
    { id: 'omatsu-smile', x: 12700, y: 566 },
    { id: 'kame-shy', x: 12736, y: 568 },
    { id: 'crowd1-merchant', x: 12800, y: 566 },
    ...(withMaster ? [{ id: 'sokichi-nod', x: 12862, y: 562 }] : []),
  ];
  return [...back, ...front];
}

const quest: QuestDef = {
  // 八頁目：橋のたもと. Invite the four people the player helped, then draw them all by the bridge. No money.
  id: 'hashi',
  prerequisites: [
    { quest: 'dougu', is: 'complete' },
    { quest: 'tenugui', is: 'complete' },
    { quest: 'kashi', is: 'complete' },
    { quest: 'fumi', is: 'complete' },
  ],
  steps: [
    { id: 'ask', doneWhen: { flag: 'hashi_ask' } },
    { id: 'invite', doneWhen: { all: [{ flag: 'hashi_okon' }, { flag: 'hashi_kisuke' }, { flag: 'hashi_omatsu' }, { flag: 'hashi_ihei' }] } },
    { id: 'draw', doneWhen: { any: [{ flag: 'hashi_with' }, { flag: 'hashi_side' }] } },
  ],
  completionEffects: [
    { type: 'familiarity', characterId: 'sokichi', eventId: 'hashi' },
    { type: 'familiarity', characterId: 'okon', eventId: 'hashi' },
    { type: 'familiarity', characterId: 'kisuke', eventId: 'hashi' },
    { type: 'familiarity', characterId: 'omatsu', eventId: 'hashi' },
    { type: 'familiarity', characterId: 'ihei', eventId: 'hashi' },
    { type: 'questState', quest: 'hashi', state: 'complete' },
  ],
  replayPolicy: 'memory-only',
};

const INVITE = (flag: string, lines: Line[]): DialogueNode => ({ effects: [{ type: 'setFlag', flag }], lines });
const nodes: Record<string, DialogueNode> = {
  'sokichi.hashi.ask': {
    effects: [{ type: 'questState', quest: 'hashi', state: 'discovered' }],
    lines: [
      { by: 'sokichi', text: '絵巻帳も、ずいぶん厚くなったな。頁をめくるたびに、お前が手を貸した人の顔がある。' },
      { by: 'sokichi', text: '最後に、その人たちを一枚に描いてみろ。お紺、喜助、おまつ、伊兵衛。橋のたもとへ来てもらうよう、声をかけてこい。' },
    ],
    choices: [
      { label: '声をかけに行く', next: 'sokichi.hashi.go' },
      { label: 'またにする', next: 'sokichi.hashi.later' },
    ],
  },
  'sokichi.hashi.later': {
    effects: [{ type: 'setFlag', flag: 'hashi_declined' }],
    lines: [{ by: 'sokichi', text: 'そうか。皆、どこへも行かん。描く気になったら言え。' }],
  },
  'sokichi.hashi.go': {
    effects: [{ type: 'setFlag', flag: 'hashi_ask' }, { type: 'questState', quest: 'hashi', state: 'active' }],
    recallNext: 'sokichi.hashi.gather',
    lines: [{ by: 'narration', text: '四人に声をかけて回ろう。道具屋と茶店、米屋のあたりの往来、それに橋の向こうの河岸だ。' }],
  },
  'sokichi.hashi.waiting': {
    lines: [{ by: 'sokichi', text: 'まだ声をかけていない人がいるな。急がんでいい。皆がそろってからだ。' }],
  },
  'okon.hashi': INVITE('hashi_okon', [
    { by: 'okon', text: 'あたしを絵に？ 照れるねえ。……いいよ、店はちょいと清太さんに見ててもらう。' },
    { by: 'okon', text: '金次も呼んどくよ。あの弁当箱を持たせてね。' },
  ]),
  'kisuke.hashi': INVITE('hashi_kisuke', [
    { by: 'kisuke', text: '皆で一枚か。それなら茶を一つ持っていこう。絵の中でも、湯気くらいは立てたいからな。' },
    { by: 'kisuke', text: 'お春ちゃんにも声をかけておくよ。あの子は、こういうのが好きだ。' },
  ]),
  'omatsu.hashi': INVITE('hashi_omatsu', [
    { by: 'omatsu', text: 'あたしなんか描いたって、魚のにおいしかしないよ。……でも、亀吉が喜ぶね。' },
    { by: 'kamekichi', text: 'おいらも行く！ 橋のたもとからなら、舟がよく見えるもんな！' },
  ]),
  'ihei.hashi': INVITE('hashi_ihei', [
    { by: 'ihei', text: 'わたしでよければ。……母への次の文に、その絵のことを書けますね。' },
    { by: 'ihei', text: '得意先を一つ回ったら、すぐに参ります。' },
  ]),
  'sokichi.hashi.gather': {
    cg: 'hashi',
    lines: [
      { by: 'narration', text: '昼すぎ、橋のたもとの空き地に、一人、また一人と人が集まってきた。' },
      { by: 'okon', text: 'ほら金次、もっと寄りな。弁当箱、見えるように持って。' },
      { by: 'kinji', text: 'こ、こうかい？ 絵に描かれるなんて、生まれて初めてだよ。' },
      { by: 'kisuke', text: '茶が冷めないうちに頼むよ。' },
      { by: 'oharu', text: '手拭い、ちゃんと首に巻いてきました。' },
      { by: 'kamekichi', text: 'ばあちゃん、まっすぐ立って！' },
      { by: 'omatsu', text: '見えなくたって、立つくらいはできるよ。' },
      { by: 'ihei', text: '清太さん、紙が飛ばないように押さえていてくださいね。' },
      { by: 'seita', text: '今日は風がありませんから。……たぶん。' },
      { by: 'sokichi', text: 'さて。どう描く。' },
    ],
    choices: [
      { label: '師匠も皆の中に描く', next: 'hashi.with' },
      { label: '師匠の隣に立って、皆を描く', next: 'hashi.side' },
    ],
  },
  'hashi.with': {
    cg: 'hashi',
    effects: [{ type: 'setFlag', flag: 'hashi_with' }, ...quest.completionEffects],
    page: { pageId: 'p08-hashi', compositionId: 'hashi-with' },
    lines: [
      { by: 'narration', text: '「師匠も入ってください」と言うと、宗吉は少し困った顔をして、皆の端に立った。' },
      { by: 'sokichi', text: '……描かれるのは、慣れんな。だが、悪くない。絵巻帳に、八頁目が残ったな。' },
    ],
  },
  'hashi.side': {
    effects: [{ type: 'setFlag', flag: 'hashi_side' }, ...quest.completionEffects],
    page: { pageId: 'p08-hashi', compositionId: 'hashi-side' },
    lines: [
      { by: 'narration', text: '宗吉の隣に立って、皆を見渡した。筆を走らせるあいだ、誰も動かなかった。' },
      { by: 'sokichi', text: 'いい町だろう。お前が歩いて、手を貸した町だ。……八頁目、確かに見た。' },
    ],
  },
  'sokichi.hashi.after': {
    lines: [{ by: 'sokichi', text: 'あの一枚は、ときどき見返せ。描いた人たちは、明日もまた同じ通りにいる。' }],
  },
};

export const hashi: StoryModule = {
  quest,
  nodes,
  pages: [
    { id: 'p08-hashi', triggerId: 'hashi', compositionId: 'hashi-{with|side}', captionId: 'hashi', sourceRefs: [] },
    { id: 'p08-hashi-b', triggerId: 'hashi', compositionId: 'hashi-{with|side}', captionId: 'hashi', sourceRefs: [] },
  ],
  titles: {
    'p08-hashi': '橋のたもと',
    'p08-hashi-b': '橋のたもと（もう一枚）',
  },
  recallStart: 'sokichi.hashi.ask',
  place: {
    'hashi-with': '日本橋・昼　橋のたもとの空き地',
    'hashi-side': '日本橋・昼　橋のたもとの空き地',
  },
  comment: {
    'hashi-with': '描く者の師まで描いたか。……これで、一枚に町の顔がそろった。',
    'hashi-side': '皆の顔が、描くお前のほうを向いている。この町で過ごした時間が、そこに出ている。',
  },
  recallNote: 'もう一つの描き方を選べば、別の一枚が残ります。',
  entries: {
    // everyone invited, then waiting, then the ask (before the full book, which needs its page); his word after it after the full book
    sokichi: [
      { rank: 200, when: { all: [{ flag: 'hashi_okon' }, { flag: 'hashi_kisuke' }, { flag: 'hashi_omatsu' }, { flag: 'hashi_ihei' }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'sokichi.hashi.gather' },
      { rank: 201, when: { all: [{ flag: 'hashi_ask' }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'sokichi.hashi.waiting' },
      { rank: 202, when: { all: [HASHI_READY, { not: { flag: 'hashi_declined' } }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'sokichi.hashi.ask' },
      // put off once: asked again only after his other lessons have had their turn
      { rank: 350, when: { all: [HASHI_READY, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'sokichi.hashi.ask' },
      { rank: 500, when: { quest: 'hashi', is: 'complete' }, node: 'sokichi.hashi.after' },
    ],
    okon: [
      { rank: 50, when: { all: [{ flag: 'hashi_ask' }, { not: { flag: 'hashi_okon' } }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'okon.hashi' },
    ],
    kisuke: [
      { rank: 50, when: { all: [{ flag: 'hashi_ask' }, { not: { flag: 'hashi_kisuke' } }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'kisuke.hashi' },
    ],
    omatsu: [
      { rank: 50, when: { all: [{ flag: 'hashi_ask' }, { not: { flag: 'hashi_omatsu' } }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'omatsu.hashi' },
    ],
    ihei: [
      { rank: 50, when: { all: [{ flag: 'hashi_ask' }, { not: { flag: 'hashi_ihei' } }, { not: { quest: 'hashi', is: 'complete' } }] }, node: 'ihei.hashi' },
    ],
  },
  talk: ['sokichi.hashi.after'],
  valid: (pageId, compositionId) => (pageId === 'p08-hashi' || pageId === 'p08-hashi-b' ? compositionId === 'hashi-with' || compositionId === 'hashi-side' : null),
  view: (composition) => (composition === 'hashi-with' || composition === 'hashi-side' ? { x0: 12620, y0: 190, w: 400, people: hashiGroup(composition === 'hashi-with') } : null),
  nearbyRank: 90,
  // once the four have their pages; then the people not yet invited, nearest first
  nearby: (c) => {
    const out: Nearby[] = [];
    const hashi = c.questState('hashi');
    if (hashi !== 'complete' && HASHI_PEOPLE.every((p) => c.questState(p.quest) === 'complete')) {
      const left = HASHI_PEOPLE.filter((p) => !c.hasFlag(`hashi_${p.id}`));
      const here = c.here;
      if (here !== undefined) left.sort((p, q) => Math.abs(c.xOf(p.spot) - here) - Math.abs(c.xOf(q.spot) - here));
      if (c.hasFlag('hashi_ask') && left.length === 0) out.push({ id: 'hashi-done', text: '皆に声をかけ終えた。橋のたもとの宗吉のところへ', spotId: 'h-sokichi' });
      else if (c.hasFlag('hashi_ask')) out.push({ id: 'hashi-invite', text: `橋のたもとへ来てもらうよう声をかける（あと${left.length}人）。${left.map((p) => p.name).join('、')}`, spotId: left[0].spot });
      else out.push({ id: 'hashi', text: '宗吉が、絵巻帳をめくりながら何か考えている', spotId: 'h-sokichi' });
    }
    return out;
  },
};
