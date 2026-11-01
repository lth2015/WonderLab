import type { ChatMessage } from './tokenstars.js';

// 清明上河図：江戸編 — 即興のひとこと (spec §12). After a story is done, the
// player can stay and talk a little with the person. The model only voices a
// line: who they are, what happened between them and the player, and what may
// be talked about all live here on the server, chosen from fixed lists. The
// player never types, so nothing they write reaches the model, and the line
// changes no money, item or progress. If anything goes wrong the app shows the
// person's scripted line instead.

export const TALK_TOPICS = ['today', 'work', 'earlier'] as const;
export type TalkTopic = (typeof TALK_TOPICS)[number];
export const TALK_STORIES = ['kaze', 'dougu', 'tenugui'] as const;
export type TalkStory = (typeof TALK_STORIES)[number];

interface Persona {
  who: string;
  voice: string;
  work: string;
  /** What this person knows happened, by finished story. */
  memories: Partial<Record<TalkStory, string>>;
}

export const PERSONAS: Record<string, Persona> = {
  seita: {
    who: '紙屋「青葉屋」の手代、清太。二十歳前後。',
    voice: 'まじめで少しあわて者。ていねいな言葉に、ときどき江戸の言い回しがまじる。',
    work: '漉き上がった紙を店先にならべ、番頭さんに叱られないよう気を配っている。',
    memories: {
      kaze: '今朝、風で店先の紙が飛びかけたとき、この見習いが文鎮で押さえてくれた。',
    },
  },
  okon: {
    who: '道具屋「くれ竹」のおかみ、お紺。四十ほど。',
    voice: 'さっぱりした世話好き。下町のくだけた言葉。',
    work: '漆の器や小道具を手入れして、なじみの客に返している。',
    memories: {
      kaze: '見習いが青葉屋の紙を押さえるところを見ていた。',
      dougu: '金次の父の代からの弁当箱を塗り直し、見習いといっしょに印の布で包んで返した。',
    },
  },
  kinji: {
    who: '振売りの金次。三十ほど。天秤棒で品を売り歩く。',
    voice: '威勢がよいが照れ屋。べらんめえ調を少し。',
    work: '朝の商いをすませ、米屋の前でひと休みしている。',
    memories: {
      dougu: '父の代からの弁当箱がきれいに塗り直されて戻ってきた。届けてくれたのはこの見習いか、使いのお春。',
    },
  },
  kisuke: {
    who: '茶店「喜の字」の主人、喜助。五十ほど。',
    voice: '穏やかで、常連の顔と好みをよく覚えている。',
    work: '朝から茶を出し、通りの往来をながめている。',
    memories: {
      tenugui: '見習いが茶を運ぶのを手伝い、忘れ物の手拭いの持ち主をいっしょに見つけた。',
    },
  },
  oharu: {
    who: '町の使いのお春。十八。',
    voice: 'ひたむきで、ていねいな話し方。',
    work: '町の家々の使い走りをしている。',
    memories: {
      dougu: 'お紺に頼まれて、金次に包みを届けたことがある。',
      tenugui: 'ご隠居の、亡くなったおかみさんが染めた手拭いを、見習いが見つけてくれた。',
    },
  },
  sokichi: {
    who: '町の絵師、宗吉。六十ほど。この見習いの師匠。',
    voice: '無口で言葉は短い。だが人を見る目は温かい。',
    work: '日本橋の往来を絵巻に写している。',
    memories: {
      kaze: '見習いが絵巻帳の最初の一頁を描いた。',
      dougu: '見習いが道具を届ける一頁を描いた。',
      tenugui: '見習いが手拭いの一件を一頁に残した。',
    },
  },
};

const TOPIC_TEXT: Record<TalkTopic, string> = {
  today: '今朝の日本橋の町のようす（天気、往来、季節は春）',
  work: '自分の仕事や店のこと',
  earlier: 'この見習いと今日あったこと',
};

/** The request, as the app may send it. Anything else is refused. */
export function parseTalk(body: unknown): { who: string; topic: TalkTopic; done: TalkStory[]; turn: number } | null {
  const b = body as { who?: unknown; topic?: unknown; done?: unknown; turn?: unknown } | null;
  // own keys only: `in` would also let "constructor" or "__proto__" through
  if (!b || typeof b.who !== 'string' || !Object.hasOwn(PERSONAS, b.who)) return null;
  if (typeof b.topic !== 'string' || !(TALK_TOPICS as readonly string[]).includes(b.topic)) return null;
  const done = Array.isArray(b.done) ? b.done.filter((d): d is TalkStory => (TALK_STORIES as readonly string[]).includes(d as string)) : [];
  const turn = typeof b.turn === 'number' && Number.isInteger(b.turn) ? Math.min(Math.max(b.turn, 0), 5) : 0;
  return { who: b.who, topic: b.topic as TalkTopic, done: [...new Set(done)], turn };
}

export function talkMessages(who: string, topic: TalkTopic, done: TalkStory[], turn: number): ChatMessage[] {
  const p = PERSONAS[who];
  const memories = done.map((d) => p.memories[d]).filter(Boolean);
  const system = [
    `あなたは文化二年（1805年）春の江戸・日本橋の町の人物を演じる。人物は創作。`,
    `人物：${p.who}`,
    `話し方：${p.voice}`,
    `ふだん：${p.work}`,
    memories.length ? `この相手（絵師の見習い）とのこと：${memories.join(' ')}` : '相手は絵師の見習い。',
    '決まり：',
    '- 読みやすい現代日本語に、人物らしい江戸の言い回しを少し添える。',
    '- 60〜120字の、ひとまとまりのせりふを一つだけ。地の文や説明は書かない。',
    '- 現代の物や言葉、外来語、数字の年号は使わない。実在の店・人物・事件を出さない。',
    '- 病気・薬・効能、お金の額、品物をあげる約束、相手への質問攻めはしない。',
    '- ゲーム、AI、作り話であることには触れない。',
    '- 出力は {"line": "せりふ"} のJSONだけ。',
  ].join('\n');
  const user = `話題：${TOPIC_TEXT[topic]}。${turn > 0 ? `これは${turn + 1}度目のひとこと。前と違う切り口で。` : ''}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** The model's line, if it is fit to show; otherwise null and the app uses the script. */
export function cleanLine(value: unknown): string | null {
  const raw = (value as { line?: unknown } | null)?.line;
  if (typeof raw !== 'string') return null;
  const line = raw.trim().replace(/^[「『"]+|[」』"]+$/g, '').trim();
  const n = [...line].length;
  if (n < 15 || n > 150) return null;
  // Japanese only: no Latin letters, URLs, digits or markup, full-width ones included
  if (/[A-Za-z0-9<>{}\\[\]@#$%^*_=|~`]/.test(line.normalize('NFKC'))) return null;
  if (!/[぀-ヿ]/.test(line)) return null;
  return line;
}

/** A small per-day budget: per visitor and in total. Resets at UTC midnight. */
export class TalkBudget {
  private day = '';
  private total = 0;
  private perIp = new Map<string, number>();
  constructor(
    private readonly perVisitor: number,
    private readonly daily: number,
  ) {}
  take(ipAddr: string, now = new Date()): boolean {
    const ip = visitorKey(ipAddr);
    const d = now.toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.total = 0;
      this.perIp.clear();
    }
    const mine = this.perIp.get(ip) ?? 0;
    if (mine >= this.perVisitor || this.total >= this.daily) return false;
    this.perIp.set(ip, mine + 1);
    this.total++;
    return true;
  }
}

/** One visitor per IPv4 address, and per IPv6 /64 (one home or phone gets a whole /64). */
export function visitorKey(ip: string): string {
  const v6 = ip.startsWith('::ffff:') ? null : ip.includes(':') ? ip : null;
  if (!v6) return ip.replace(/^::ffff:/, '');
  const [head, tail = ''] = v6.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return full.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
