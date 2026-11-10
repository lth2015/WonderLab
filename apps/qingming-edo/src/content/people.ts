// 人物帳 (owner's demo feedback 2026-11-04: RPG-like; spec §11 なじみ): the people of the
// street the player has met, with how well they know each other. なじみ moves only with
// particular shared events (engine/state.ts familiarity), never by repetition.

/** The order of the book: the master, then the street from the shops to the far bank. */
export const PEOPLE = ['sokichi', 'seita', 'okon', 'kinji', 'kisuke', 'oharu', 'inkyo', 'ihei', 'omatsu', 'kamekichi'] as const;

/** What the player knows of each, in a line. */
export const PROFILE: Record<(typeof PEOPLE)[number], string> = {
  sokichi: '日本橋の通りを描きつづけている絵師。口数は少ないが、見るところは見ている。',
  seita: '青葉屋の若い手代。紙の扱いがていねいで、番頭さんには頭が上がらない。',
  okon: '道具屋くれ竹のおかみ。道具の手入れと、人の世話が上手。',
  kinji: '天秤棒をかつぐ振売り。売り声が大きく、親父の代からの道具を大事にしている。',
  kisuke: '茶店「喜の字」の主人。町の人の話を、茶を出しながらぜんぶ聞いている。',
  oharu: '町じゅうのお使いを引き受ける娘。足が速く、言付けを間違えない。',
  inkyo: '茶店の常連のご隠居。亡くなったおかみさんの染めた手拭いを、毎日腰に下げている。',
  ihei: '両替屋の手代。郷の母へ、なかなか文を出せずにいた。',
  omatsu: '向こう岸の河岸で魚を売るおばあさん。孫の亀吉に手を焼いている。',
  kamekichi: 'おまつの孫。舟が好きで、目を離すとすぐどこかへ隠れる。',
};

/** Spec §11: なじみ in three steps. */
export const NAJIMI = ['初めて', '顔なじみ', '気の置けない間柄'] as const;
