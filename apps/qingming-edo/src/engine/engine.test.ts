import { describe, expect, it } from 'vitest';
import { ENTRIES, NODES, ON_CLOSE, RECALL_START } from '../content/script';
import { FALLBACK, TALK_CLOSE, TALK_TOPICS } from '../content/talk';
import { characterById, frameOf, parseUgoki, UGOKI_PEOPLE, GUIDE_STOPS, HOTSPOTS, PAGE_SLOTS, PAGE_TITLES, PAGES, questById, questOfPage, SCENE_W, parseSketch, SKETCHES, sketchPageId } from '../content/world';
import type { Effect, HotspotDef, SaveData } from '../contract';
import { clampCamera, effectiveArea, isDrag, resolveTap } from './hit';
import { exportText, importText, load, persist, SAVE_KEY } from './save';
import { addPage, addRecallPage, apply, hasFlag as hasFlagFn, newSave, questState, test } from './state';
import { entryFor, nearby, nearbyAll, visibleSpots } from './story';
import { reachedTimes, timeOf } from './time';
import { DEFAULT_LEVELS, LEVEL_STEPS, levelsOf } from './sound';

const memory = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

/** Walks a node chain as the player would, always taking the given choice labels. */
function play(s: SaveData, start: string, pick: string[] = []): SaveData {
  let id: string | undefined = start;
  const picks = [...pick];
  while (id) {
    const n: (typeof NODES)[string] = NODES[id];
    if (n.effects) s = apply(s, n.effects);
    if (n.choices) {
      const c = n.choices.find((x) => x.label === picks[0]) ?? null;
      if (!c) break;
      picks.shift();
      if (c.effects) s = apply(s, c.effects);
      if (c.sketch) break;
      id = c.next;
    } else id = n.next;
  }
  return s;
}

function finishSketch(s: SaveData): SaveData {
  s = addPage(s, { pageId: 'p01-kaze', compositionId: 'kaze-hands-near', titleStyle: 'plain', madeAt: new Date().toISOString() });
  return apply(s, [{ type: 'setFlag', flag: 'kaze_page' }, { type: 'questState', quest: 'kaze', state: 'ready' }]);
}

describe('風のいたずら', () => {
  it('can be finished from the papers alone, and pays 12文 once', () => {
    let s = newSave();
    expect(s.wallet.balanceMinor).toBe(60);
    s = play(s, entryFor('papers', s)!, ['働く手を描く']);
    expect(questState(s, 'kaze')).toBe('active');
    s = finishSketch(s);
    s = play(s, 'kaze.after.hands');
    expect(questState(s, 'kaze')).toBe('complete');
    expect(s.wallet.balanceMinor).toBe(72);
    // replaying the thanks, or a stale dialogue, never pays again
    s = play(s, 'kaze.reward');
    s = apply(s, questById.get('kaze')!.completionEffects);
    expect(s.wallet.balanceMinor).toBe(72);
    expect(s.journal.pages).toHaveLength(1);
    expect(s.progress.familiarity.seita.level).toBe(1);
  });

  it('gives the thanks later if the dialogue was closed after the page was made', () => {
    let s = play(newSave(), 'kaze.pressed');
    s = finishSketch(s); // closed before kaze.after.*
    expect(entryFor('seita', s)).toBe('kaze.reward');
    expect(entryFor('sokichi', s)).toBe('kaze.reward');
    s = play(s, entryFor('sokichi', s)!);
    expect(s.wallet.balanceMinor).toBe(72);
    expect(entryFor('seita', s)).toBe('seita.done');
  });

  it('declining is fine and the story stays open (spec §8 断られた時)', () => {
    let s = newSave();
    s = play(s, entryFor('seita', s)!, ['少し様子を見る']);
    expect(questState(s, 'kaze')).toBe('discovered');
    expect(entryFor('seita', s)).toBe('seita.first');
    expect(visibleSpots(s).some((h) => h.id === 'h-papers')).toBe(true);
  });

  it('a page is made once; making it again keeps the first', () => {
    let s = finishSketch(play(newSave(), 'kaze.pressed'));
    s = addPage(s, { pageId: 'p01-kaze', compositionId: 'kaze-street-wide', titleStyle: 'indigo', madeAt: new Date().toISOString() });
    expect(s.journal.pages.map((p) => p.compositionId)).toEqual(['kaze-hands-near']);
  });

  it('quests never move backwards', () => {
    let s = apply(newSave(), [{ type: 'questState', quest: 'kaze', state: 'complete' }]);
    s = apply(s, [{ type: 'questState', quest: 'kaze', state: 'active' }]);
    expect(questState(s, 'kaze')).toBe('complete');
  });

  it('「近くのこと」 shows at most three and leads to the story first', () => {
    const s = newSave();
    expect(nearby(s)).toHaveLength(3);
    expect(nearby(s)[0].spotId).toBe('h-papers');
  });
});

/** Opens a node as the app does: effects, then its page (once). */
function open(s: SaveData, id: string): SaveData {
  const n = NODES[id];
  if (n.effects) s = apply(s, n.effects);
  if (n.page) s = addPage(s, { pageId: n.page.pageId, compositionId: n.page.compositionId, titleStyle: 'plain', madeAt: new Date().toISOString() });
  return s;
}

function afterKaze(): SaveData {
  let s = play(newSave(), 'kaze.pressed', ['働く手を描く']);
  s = finishSketch(s);
  return play(s, 'kaze.after.hands');
}

describe('いつもの道具', () => {
  it('お紺 only asks once 風のいたずら is done', () => {
    expect(entryFor('okon', newSave())).toBe('okon.first');
    expect(entryFor('okon', afterKaze())).toBe('okon.ask');
  });

  it('declining keeps the story open, and she asks again kindly', () => {
    let s = open(afterKaze(), 'okon.declined');
    expect(entryFor('okon', s)).toBe('okon.ask.again');
    expect(questState(s, 'dougu')).toBe('undiscovered');
    s = open(s, 'okon.wrapped');
    expect(entryFor('okon', s)).toBe('okon.choose');
  });

  it('delivering it yourself: 24文 once, a page, 金次 remembers you', () => {
    let s = open(open(afterKaze(), 'okon.wrapped'), 'okon.carry');
    expect(entryFor('kinji', s)).toBe('kinji.receive');
    expect(entryFor('okon', s)).toBe('okon.carrying');
    s = open(s, 'kinji.receive');
    expect(questState(s, 'dougu')).toBe('complete');
    expect(s.wallet.balanceMinor).toBe(72 + 24);
    expect(s.journal.pages.map((p) => p.compositionId)).toEqual(['kaze-hands-near', 'dougu-deliver']);
    expect(s.progress.familiarity.kinji?.level).toBe(1);
    // the same dialogue again, or a stale one: nothing more
    s = open(s, 'kinji.receive');
    expect(s.wallet.balanceMinor).toBe(96);
    expect(s.journal.pages).toHaveLength(2);
    expect(entryFor('kinji', s)).toBe('kinji.done');
    expect(entryFor('okon', s)).toBe('okon.done');
  });

  it('entrusting it to お春: the same 24文, a different page, and no second ending', () => {
    let s = open(open(afterKaze(), 'okon.wrapped'), 'okon.entrust');
    expect(questState(s, 'dougu')).toBe('complete');
    expect(s.wallet.balanceMinor).toBe(96);
    expect(s.journal.pages.map((p) => p.compositionId)).toEqual(['kaze-hands-near', 'dougu-entrust']);
    expect(entryFor('kinji', s)).toBe('kinji.done.entrust');
    expect(entryFor('oharu', s)).toBe('oharu.after');
    // no way back into the delivery from here
    expect(hasFlagFn(s, 'dougu_carry')).toBe(false);
  });

  it('carrying the bundle shows in 持ち物 and 近くのこと points to 金次', () => {
    const s = open(open(afterKaze(), 'okon.wrapped'), 'okon.carry');
    expect(nearby(s)[0]).toMatchObject({ id: 'dougu-carry', spotId: 'h-kinji' });
  });
});

describe('あの人の手拭い', () => {
  it('お春 asks only after 風のいたずら, and 喜助 knows about it only once she has', () => {
    expect(entryFor('oharu', newSave())).toBe('oharu.first');
    const s = afterKaze();
    expect(entryFor('oharu', s)).toBe('oharu.ask');
    expect(entryFor('kisuke', s)).toBe('kisuke.first');
  });

  it('follows ask → tea → compare → return, and pays 18文 once', () => {
    let s = open(afterKaze(), 'oharu.accepted');
    expect(entryFor('kisuke', s)).toBe('kisuke.lost');
    expect(nearby(s).some((n) => n.id === 'tenugui-kisuke' && n.spotId === 'h-kisuke')).toBe(true);
    s = open(s, 'kisuke.served');
    expect(entryFor('kisuke', s)).toBe('kisuke.compare');
    s = open(s, 'kisuke.picked');
    expect(entryFor('oharu', s)).toBe('oharu.return');
    expect(nearby(s).some((n) => n.id === 'tenugui-return' && n.spotId === 'h-oharu')).toBe(true);
    s = open(s, 'oharu.return');
    expect(questState(s, 'tenugui')).toBe('complete');
    expect(s.wallet.balanceMinor).toBe(72 + 18);
    expect(s.journal.pages.map((p) => p.pageId)).toEqual(['p01-kaze', 'p03-tenugui']);
    s = open(s, 'oharu.return');
    expect(s.wallet.balanceMinor).toBe(90);
    expect(entryFor('oharu', s)).toBe('oharu.done3');
    expect(entryFor('kisuke', s)).toBe('kisuke.done3');
  });

  it('declining leaves it open; asking again is kind', () => {
    const s = open(afterKaze(), 'oharu.declined');
    expect(entryFor('oharu', s)).toBe('oharu.ask.again');
  });

  it('after carrying お紺\'s bundle, お春 reports that first, then asks', () => {
    let s = open(open(afterKaze(), 'okon.wrapped'), 'okon.entrust');
    expect(entryFor('oharu', s)).toBe('oharu.after');
    expect(NODES['oharu.after'].next).toBe('oharu.ask');
    s = open(s, 'oharu.after');
    expect(entryFor('oharu', s)).toBe('oharu.ask');
  });

  it('all three stories together pay 12 + 24 + 18 and leave three pages', () => {
    let s = open(open(afterKaze(), 'okon.wrapped'), 'okon.carry');
    s = open(s, 'kinji.receive');
    s = open(open(open(open(s, 'oharu.accepted'), 'kisuke.served'), 'kisuke.picked'), 'oharu.return');
    expect(s.wallet.balanceMinor).toBe(60 + 12 + 24 + 18);
    expect(s.journal.pages).toHaveLength(3);
  });
});

describe('回想', () => {
  const doneDeliver = () => open(open(open(afterKaze(), 'okon.wrapped'), 'okon.carry'), 'kinji.receive');

  it('the other ending leaves one more page, once, and pays nothing', () => {
    let s = doneDeliver();
    const money = s.wallet.balanceMinor;
    s = addRecallPage(s, 'p02-dougu', 'dougu-entrust');
    expect(s.journal.pages.map((p) => `${p.pageId}:${p.compositionId}`)).toContain('p02-dougu-b:dougu-entrust');
    expect(s.wallet.balanceMinor).toBe(money);
    // again, either ending: nothing more
    const before = s;
    expect(addRecallPage(s, 'p02-dougu', 'dougu-entrust')).toBe(before);
    expect(addRecallPage(s, 'p02-dougu', 'dougu-deliver')).toBe(before);
  });

  it('the same ending again adds nothing', () => {
    const s = doneDeliver();
    expect(addRecallPage(s, 'p02-dougu', 'dougu-deliver')).toBe(s);
  });

  it('another sketch of 一頁目 is kept as its own page', () => {
    const s = addRecallPage(afterKaze(), 'p01-kaze', 'kaze-street-wide', 'indigo');
    expect(s.journal.pages.find((p) => p.pageId === 'p01-kaze-b')).toMatchObject({ compositionId: 'kaze-street-wide', titleStyle: 'indigo' });
  });

  it('nothing is added for a story not yet finished', () => {
    const s = newSave();
    expect(addRecallPage(s, 'p02-dougu', 'dougu-entrust')).toBe(s);
  });

  it('every story starts its recall at a real node, and every walk-away node goes on to one', () => {
    for (const [q, start] of Object.entries(RECALL_START)) {
      expect(questById.get(q), q).toBeDefined();
      expect(NODES[start], start).toBeDefined();
    }
    for (const [id, n] of Object.entries(NODES)) if (n.recallNext) expect(NODES[n.recallNext], id).toBeDefined();
  });

  it('a recall shows no line about being paid, and every story still has something to show', () => {
    for (const [id, n] of Object.entries(NODES)) {
      const shown = n.lines.filter((l) => !l.reward);
      if (/文を受け取った/.test(n.lines.map((l) => l.text).join())) expect(shown.some((l) => /文を受け取った/.test(l.text)), id).toBe(false);
    }
  });

  it('extra pages belong to their story', () => {
    expect(questOfPage('p02-dougu-b')).toBe('dougu');
    expect(questOfPage('p01-kaze-b')).toBe('kaze');
  });
});

describe('即興のひとこと', () => {
  it('every person you can stay with has a scripted line for each topic and a goodbye', () => {
    for (const n of Object.values(NODES))
      for (const c of n.choices ?? [])
        if (c.talk) {
          const who = n.lines.find((l) => l.by !== 'narration')!.by;
          for (const t of TALK_TOPICS) expect(FALLBACK[who]?.[t.id], `${who} ${t.id}`).toBeTruthy();
          expect(TALK_CLOSE[who], who).toBeTruthy();
        }
  });
  it('talk is offered only once a story is done, never while asking for help', () => {
    expect(NODES['seita.first'].choices?.some((c) => c.talk)).toBeFalsy();
    expect(NODES['seita.done'].choices?.some((c) => c.talk)).toBe(true);
  });
});

describe('朝・昼・夕', () => {
  const all3 = () => {
    let s = open(open(open(afterKaze(), 'okon.wrapped'), 'okon.carry'), 'kinji.receive');
    return open(open(open(open(s, 'oharu.accepted'), 'kisuke.served'), 'kisuke.picked'), 'oharu.return');
  };
  it('moves only when a story ends', () => {
    expect(timeOf(newSave())).toBe('morning');
    expect(timeOf(play(newSave(), 'kaze.pressed'))).toBe('morning'); // mid-story: still morning
    expect(timeOf(afterKaze())).toBe('noon');
    const half = open(open(open(afterKaze(), 'okon.wrapped'), 'okon.carry'), 'kinji.receive');
    expect(timeOf(half)).toBe('noon');
    expect(timeOf(all3())).toBe('evening');
  });
  it('lets the player go back to a reached time, never forward to an unreached one', () => {
    const s = afterKaze();
    expect(timeOf({ ...s, settings: { ...s.settings, timeChoice: 'morning' } })).toBe('morning');
    expect(timeOf({ ...s, settings: { ...s.settings, timeChoice: 'evening' } })).toBe('noon');
    expect(reachedTimes(all3())).toEqual(['morning', 'noon', 'evening']);
  });
  it('no story can be missed because of the time of day (spec §11)', () => {
    // A rule may name a time only for a story whose prerequisites already unlock that time
    // (夕暮れの灯 needs いつもの道具 and あの人の手拭い, which open 夕), so the player can always
    // switch to it from the time menu; and 「近くのこと」 says so when another time is shown.
    const timed = Object.entries(ENTRIES).filter(([, rules]) => JSON.stringify(rules).match(/"time"/));
    expect(timed.map(([who]) => who).sort()).toEqual(['kisuke', 'sokichi']);
    // 朝 is open from the start; 夕 only through the stories 夕暮れの灯 already requires
    expect(JSON.stringify(ENTRIES.kisuke)).not.toMatch(/morning|noon/);
    expect(JSON.stringify(ENTRIES.sokichi)).not.toMatch(/evening|noon/);
    expect(JSON.stringify(ENTRIES)).not.toMatch(/timeChoice/);
    expect(reachedTimes(all3())).toContain('evening');
    const shownMorning = apply(all3(), [{ type: 'setFlag', flag: 'yube_fire' }]);
    const m = { ...shownMorning, settings: { ...shownMorning.settings, timeChoice: 'morning' as const } };
    expect(nearbyAll(m).find((n) => n.id === 'yube-light')?.text).toContain('夕方になったら');
  });
  it('an old save without a time choice loads as auto', () => {
    const old = { ...newSave(), settings: { reduceMotion: false, textScale: 1 } };
    const r = importText(JSON.stringify(old));
    expect(r.ok && r.save.settings.timeChoice).toBe('auto');
  });
});

describe('script integrity', () => {
  it('every link, entry and close effect names a real node', () => {
    for (const [id, n] of Object.entries(NODES)) {
      if (n.next) expect(NODES[n.next], `${id} → ${n.next}`).toBeDefined();
      for (const c of n.choices ?? []) if (c.next) expect(NODES[c.next], `${id} → ${c.next}`).toBeDefined();
      if (n.page) expect(PAGES.some((p) => p.id === n.page!.pageId), `${id}: ${n.page.pageId}`).toBe(true);
      for (const l of n.lines) if (l.by !== 'narration') expect(characterById.get(l.by), `${id}: ${l.by}`).toBeDefined();
    }
    for (const rules of Object.values(ENTRIES)) for (const r of rules) expect(NODES[r.node]).toBeDefined();
    for (const k of Object.keys(ON_CLOSE)) expect(NODES[k]).toBeDefined();
  });

  it('every character and prop on the street opens something; the last rule always matches', () => {
    for (const h of HOTSPOTS.filter((x) => x.kind !== 'ambient')) {
      const rules = ENTRIES[h.targetId];
      expect(rules, h.id).toBeDefined();
      expect(rules[rules.length - 1].when).toBeUndefined();
    }
  });

  it('no line runs long (spec §12: about 60–120 characters)', () => {
    for (const [id, n] of Object.entries(NODES)) for (const l of n.lines) expect([...l.text].length, id).toBeLessThanOrEqual(120);
  });

  it('children never get anything but a script (spec §8)', () => {
    const children = [...characterById.values()].filter((c) => c.isChild).map((c) => c.id);
    expect(children).toEqual(['kamekichi']); // 亀吉 (河岸の朝)
    for (const id of children) {
      // no generated talk: no 「少し話す」 on any node the child opens, and no talk lines at all
      for (const rule of ENTRIES[id]) expect(NODES[rule.node].choices?.some((c) => c.talk) ?? false).toBe(false);
      expect(FALLBACK[id]).toBeUndefined();
    }
  });
});

describe('effects and conditions', () => {
  it('rejects a negative or fractional reward instead of paying it', () => {
    expect(() => apply(newSave(), [{ type: 'grant', rewardId: 'x', amountMinor: -5 } as Effect])).toThrow();
    expect(() => apply(newSave(), [{ type: 'grant', rewardId: 'x', amountMinor: 1.5 } as Effect])).toThrow();
  });
  it('an unknown condition shape is false, never evaluated', () => {
    expect(test(newSave(), { eval: 'true' } as never)).toBe(false);
  });
  it('apply leaves the input save untouched', () => {
    const s = newSave();
    apply(s, [{ type: 'grant', rewardId: 'r', amountMinor: 5 }]);
    expect(s.wallet.balanceMinor).toBe(60);
  });
});

describe('save', () => {
  it('round-trips through storage and the exported file', () => {
    const st = memory();
    const s = apply(newSave(), [{ type: 'setFlag', flag: 'paper_pressed' }]);
    persist(st, s);
    const r = load(st);
    expect(r.kind).toBe('loaded');
    expect(r.save.progress.flags).toEqual(['paper_pressed']);
    const i = importText(exportText(s));
    expect(i.ok && i.save.progress.flags).toEqual(['paper_pressed']);
  });

  it('keeps a damaged save aside and starts fresh, without losing it', () => {
    const st = memory();
    st.setItem(SAVE_KEY, '{"worldId":"qingming-edo",');
    const r = load(st, new Date(1000));
    expect(r.kind).toBe('corrupt');
    if (r.kind === 'corrupt') expect(st.m.get(r.backupKey)).toBe('{"worldId":"qingming-edo",');
  });

  it("does not take the China edition's save, nor any other work's", () => {
    const other = { ...newSave(), worldId: 'qingming-china' };
    expect(importText(JSON.stringify(other)).ok).toBe(false);
  });

  it('leaves a save from a newer version untouched', () => {
    const st = memory();
    const newer = JSON.stringify({ ...newSave(), saveVersion: 99 });
    st.setItem(SAVE_KEY, newer);
    expect(load(st).kind).toBe('newer');
    expect(st.m.get(SAVE_KEY)).toBe(newer);
    expect(importText(newer)).toEqual({ ok: false, reason: 'newer' });
  });

  it('rejects a tampered wallet', () => {
    const bad = { ...newSave(), wallet: { currencyId: 'mon', balanceMinor: -100, grantedRewardIds: [] } };
    expect(importText(JSON.stringify(bad)).ok).toBe(false);
    const frac = { ...newSave(), wallet: { currencyId: 'mon', balanceMinor: 1.5, grantedRewardIds: [] } };
    expect(importText(JSON.stringify(frac)).ok).toBe(false);
  });

  it('plays on when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(load(blocked).kind).toBe('fresh');
    expect(persist(blocked, newSave())).toBe(false);
  });
});

describe('touch', () => {
  const spot = (id: string, x: number, priority = 5, w = 10): HotspotDef => ({
    id,
    targetId: id,
    kind: 'character',
    anchor: { x, y: 50 },
    hitArea: { x, y: 40, w, h: 20 },
    priority,
  });

  it('a move beyond 8 px is a drag, not a tap', () => {
    expect(isDrag(8, 0)).toBe(false);
    expect(isDrag(6, 6)).toBe(true);
  });

  it('small targets answer on 44 CSS px', () => {
    const a = effectiveArea({ x: 100, y: 100, w: 10, h: 10 }, 0.5); // 44 px = 88 units
    expect(a.w).toBe(88);
    expect(a.x + a.w / 2).toBe(105);
  });

  it('higher priority wins; ties offer up to three, in a stable order', () => {
    expect(resolveTap([spot('a', 0, 5), spot('b', 0, 8)], 5, 50, 1).map((h) => h.id)).toEqual(['b']);
    const tie = resolveTap([spot('d', 0), spot('c', 0), spot('b', 0), spot('a', 0)], 5, 50, 1);
    expect(tie.map((h) => h.id)).toEqual(['a', 'b', 'c']);
    expect(resolveTap([spot('a', 0)], 500, 50, 1)).toEqual([]);
  });

  it('the camera stays on the street', () => {
    expect(clampCamera(-50, 400, SCENE_W)).toBe(0);
    expect(clampCamera(SCENE_W + 5000, 400, SCENE_W)).toBe(SCENE_W - 400);
    expect(clampCamera(100, SCENE_W + 1000, SCENE_W)).toBe(0);
  });

  it('every street target is reachable on a 360 px phone without overlapping a person', () => {
    // scale on a 360 px wide phone (Street.tsx: w / 340)
    const scale = 360 / 340;
    const people = HOTSPOTS.filter((h) => h.kind === 'character');
    for (const p of people) {
      const hits = resolveTap(HOTSPOTS, p.anchor.x, p.anchor.y, scale);
      expect(hits[0]?.targetId, p.id).toBe(p.targetId);
    }
  });
});

describe('音の設定', () => {
  it('keeps valid levels through export and import, and falls back for old or bad ones', () => {
    const s = newSave();
    const withSound = { ...s, settings: { ...s.settings, sound: { ambient: 0, ui: 1, music: 0.35 } } };
    const r = importText(exportText(withSound));
    expect(r.ok && r.save.settings.sound).toEqual({ ambient: 0, ui: 1, music: 0.35 });
    expect(levelsOf(s.settings)).toEqual(DEFAULT_LEVELS); // a save from before sound
    const bad = importText(exportText({ ...s, settings: { ...s.settings, sound: { ambient: 3, ui: 'x', music: 0 } as never } }));
    expect(bad.ok && bad.save.settings.sound).toBeUndefined();
    expect(levelsOf({ sound: { ambient: -1, ui: 0, music: 0 } })).toEqual(DEFAULT_LEVELS);
  });
  it('offers only levels that the settings can show as pressed', () => {
    for (const v of Object.values(DEFAULT_LEVELS)) expect(LEVEL_STEPS).toContain(v);
  });
});

describe('町の写生', () => {
  const done = () => apply(newSave(), questById.get('kaze')!.completionEffects);
  it('each place is a real ambient spot, with its offer and its page', () => {
    for (const k of SKETCHES) {
      for (const sp of k.spots) expect(HOTSPOTS.some((h) => h.kind === 'ambient' && h.targetId === sp)).toBe(true);
      expect(NODES[`sk.${k.id}`].choices?.[0].next).toBe(`sk.${k.id}.made`);
      expect(NODES[`sk.${k.id}.made`].page?.pageId).toBe(sketchPageId(k.id));
      expect(PAGE_TITLES[sketchPageId(k.id)]).toBe(k.title);
      expect(k.view.y0 + (k.view.w * 660) / 520).toBeLessThanOrEqual(700); // the page's 520×660 picture stays inside the painting
    }
  });
  it('three stories, two recall pages and seven sketches fill the twelve slots exactly', () => {
    expect(PAGES.length).toBe(PAGE_SLOTS);
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGE_SLOTS);
  });
  it('「近くのこと」 points to the next undrawn place only after the first page', () => {
    expect(nearby(newSave()).some((n) => n.id === 'sketches')).toBe(false);
    let s = done();
    // make room: the other stories are finished too
    s = apply(s, [{ type: 'setFlag', flag: 'paper_pressed' }, ...['dougu', 'tenugui', 'fumi', 'kashi', 'hashi', 'inkyo'].flatMap((q) => questById.get(q)!.completionEffects)]);
    expect(nearby(s).find((n) => n.id === 'sketches')?.spotId).toBe('a-boat');
    s = addPage(s, { pageId: sketchPageId('boat'), compositionId: 'sketch-boat-noon', titleStyle: 'plain', madeAt: new Date().toISOString() });
    expect(nearby(s).find((n) => n.id === 'sketches')?.text).toContain('あと6か所');
  });
  it('a sketch page remembers the time it was drawn', () => {
    expect(parseSketch('sketch-dye-evening')?.sketch.title).toBe('紺屋の干し場');
    expect(parseSketch('sketch-dye-evening')?.tod).toBe('evening');
    expect(parseSketch('sketch-nowhere-noon')).toBeNull();
    expect(NODES['sk.dye.made'].page?.compositionId).toBe('sketch-dye-{tod}');
  });
  it('a sketch is not a story: no money and no 回想', () => {
    for (const k of SKETCHES) {
      expect(JSON.stringify(NODES[`sk.${k.id}.made`])).not.toMatch(/reward|wallet/);
      expect(questById.get(questOfPage(sketchPageId(k.id))!)).toBeUndefined();
    }
  });
});

describe('絵巻帳が一冊に', () => {
  it('twelve pages bring 宗吉 to his closing words once, then a quieter greeting', () => {
    let s = apply(newSave(), questById.get('kaze')!.completionEffects);
    const now = new Date().toISOString();
    for (const p of PAGES.slice(0, PAGE_SLOTS - 1)) s = addPage(s, { pageId: p.id, compositionId: 'x', titleStyle: 'plain', madeAt: now });
    expect(entryFor('sokichi', s)).toBe('sokichi.done');
    expect(nearby(s).some((n) => n.id === 'book')).toBe(false);
    s = addPage(s, { pageId: PAGES[PAGE_SLOTS - 1].id, compositionId: 'x', titleStyle: 'plain', madeAt: now });
    expect(entryFor('sokichi', s)).toBe('sokichi.full');
    expect(nearby(s)[0].id).toBe('book');
    s = apply(s, NODES['sokichi.full'].effects!);
    expect(entryFor('sokichi', s)).toBe('sokichi.full.again');
    expect(nearby(s).some((n) => n.id === 'book')).toBe(false);
    expect(JSON.stringify(NODES['sokichi.full'])).not.toMatch(/grant|reward/);
  });
});

describe('Codex review fixes (F01, F02)', () => {
  const withPages = (pages: unknown[]) => JSON.stringify({ ...newSave(), journal: { pages } });
  const page = (pageId: string, compositionId: string, titleStyle = 'plain') => ({ pageId, compositionId, titleStyle, madeAt: '2026-11-01T00:00:00Z' });
  it('F01: a page this version does not know is refused on import, the current save kept', () => {
    expect(importText(withPages([page('unknown-page', 'unknown-composition')])).ok).toBe(false);
    expect(importText(withPages([page('p01-kaze', 'dougu-deliver')])).ok).toBe(false); // wrong composition for the page
    expect(importText(withPages([page('p-sk-boat', 'sketch-well-noon')])).ok).toBe(false); // sketch of another place
    expect(importText(withPages([page('p01-kaze', 'kaze-hands-near'), page('p01-kaze', 'kaze-street-wide')])).ok).toBe(false); // twice
  });
  it('F01: known pages load, and an unknown title slip falls back to plain', () => {
    const r = importText(withPages([page('p01-kaze', 'kaze-hands-near', 'gold'), page('p-sk-boat', 'sketch-boat-evening'), page('p02-dougu-b', 'dougu-entrust')]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.save.journal.pages.map((p) => p.titleStyle)).toEqual(['plain', 'plain', 'plain']);
  });
  it('F02: when the backup of an unreadable save cannot be written, the original is not called kept', () => {
    const data = new Map<string, string>([[SAVE_KEY, '{broken']]);
    const full = { getItem: (k: string) => data.get(k) ?? null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    const r = load(full);
    expect(r.kind).toBe('unbacked');
    if (r.kind === 'unbacked') expect(r.original).toBe('{broken');
    // a store that silently drops the write is treated the same
    const silent = { getItem: (k: string) => data.get(k) ?? null, setItem: () => {} };
    expect(load(silent).kind).toBe('unbacked');
    // and a working store backs it up as before
    const ok = new Map<string, string>([[SAVE_KEY, '{broken']]);
    const r2 = load({ getItem: (k) => ok.get(k) ?? null, setItem: (k, v) => void ok.set(k, v) });
    expect(r2.kind).toBe('corrupt');
    if (r2.kind === 'corrupt') expect(ok.get(r2.backupKey)).toBe('{broken');
  });
});

describe('通りの案内', () => {
  it('frames story places and every sketch anchor inside a 340-unit phone view', () => {
    const subjects = [...['seita', 'sokichi', 'kisuke', 'oharu', 'kinji'], ...SKETCHES.map(k => k.spots[0])];
    for (const id of subjects) {
      const spot = HOTSPOTS.find(h => h.targetId === id);
      expect(spot, id).toBeDefined();
      expect(GUIDE_STOPS.some(g => Math.abs(g.x - spot!.anchor.x) <= 170), id).toBe(true);
    }
    expect(GUIDE_STOPS[0].x).toBeGreaterThan(13000);
    expect(GUIDE_STOPS.at(-1)!.x).toBeLessThan(1000);
  });
  it('stops run right to left inside the scene, each once', () => {
    expect(new Set(GUIDE_STOPS.map((g) => g.id)).size).toBe(GUIDE_STOPS.length);
    for (let i = 1; i < GUIDE_STOPS.length; i++) expect(GUIDE_STOPS[i].x).toBeLessThan(GUIDE_STOPS[i - 1].x);
    for (const g of GUIDE_STOPS) {
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x).toBeLessThanOrEqual(SCENE_W);
      expect([...g.note].length).toBeLessThanOrEqual(20);
    }
  });
});

describe('河岸の朝 (across the bridge)', () => {
  const asked = () => open(open(afterKaze(), 'omatsu.ask'), 'omatsu.search');
  const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);

  it('おまつ only asks once 風のいたずら is done; before, she just says hello', () => {
    expect(entryFor('omatsu', newSave())).toBe('omatsu.first');
    expect(entryFor('omatsu', afterKaze())).toBe('omatsu.ask');
    expect(nearby(afterKaze(), 14700).some((n) => n.id === 'kashi' && n.spotId === 'h-omatsu')).toBe(true); // standing on the far bank
    let s = open(open(afterKaze(), 'omatsu.ask'), 'omatsu.declined');
    expect(entryFor('omatsu', s)).toBe('omatsu.ask.again');
    expect(questState(s, 'kashi')).toBe('discovered');
  });

  it('亀吉 can be found only while he is being looked for, and the hint points at the boats, not at him', () => {
    expect(spot(afterKaze(), 'h-kame-hidden')).toBe(false);
    const s = asked();
    expect(spot(s, 'h-kame-hidden')).toBe(true);
    expect(spot(s, 'h-kame')).toBe(false);
    expect(questState(s, 'kashi')).toBe('active');
    const hint = nearby(s, 14700).find((n) => n.id === 'kashi-search');
    expect(hint?.spotId).toBe('a-kashi-boats');
    expect(entryFor('kamekichi', s)).toBe('kame.found');
    expect(entryFor('omatsu', s)).toBe('omatsu.searching');
  });

  it('bringing him straight back: 20文 once, a page, and he stands by おまつ', () => {
    let s = open(open(asked(), 'kame.found'), 'kame.now');
    expect(questState(s, 'kashi')).toBe('complete');
    expect(s.wallet.balanceMinor).toBe(72 + 20);
    expect(s.journal.pages.find((p) => p.pageId === 'p04-kashi')?.compositionId).toBe('kashi-now');
    expect(s.progress.familiarity.omatsu?.level).toBe(1);
    expect(s.progress.familiarity.kamekichi?.level).toBe(1);
    expect(spot(s, 'h-kame-hidden')).toBe(false);
    expect(spot(s, 'h-kame')).toBe(true);
    s = open(s, 'kame.now'); // again: nothing more
    expect(s.wallet.balanceMinor).toBe(92);
    expect(s.journal.pages.filter((p) => p.pageId.startsWith('p04'))).toHaveLength(1);
    expect(entryFor('omatsu', s)).toBe('omatsu.done');
    expect(entryFor('kamekichi', s)).toBe('kame.done');
  });

  it('watching the unloading first: the same 20文, the other page, and おまつ remembers it', () => {
    const s = open(open(asked(), 'kame.found'), 'kame.watch');
    expect(s.wallet.balanceMinor).toBe(92);
    expect(s.journal.pages.find((p) => p.pageId === 'p04-kashi')?.compositionId).toBe('kashi-watch');
    expect(entryFor('omatsu', s)).toBe('omatsu.done.watch');
  });

  it('closing the dialogue at the choice keeps him findable; the hint says to take him home', () => {
    const s = open(asked(), 'kame.found');
    expect(questState(s, 'kashi')).toBe('active');
    expect(entryFor('kamekichi', s)).toBe('kame.found');
    expect(nearby(s, 14700).find((n) => n.id === 'kashi-home')?.spotId).toBe('h-kame-hidden');
  });

  it('回想 leaves the other ending as one more page, paying nothing', () => {
    let s = open(open(asked(), 'kame.found'), 'kame.now');
    s = addRecallPage(s, 'p04-kashi', 'kashi-watch');
    expect(s.journal.pages.find((p) => p.pageId === 'p04-kashi-b')?.compositionId).toBe('kashi-watch');
    expect(s.wallet.balanceMinor).toBe(92);
    expect(RECALL_START.kashi).toBe('omatsu.ask');
    expect(NODES['omatsu.search'].recallNext).toBe('kame.found');
  });

  it('everything across the bridge is inside the scene, and the book now holds every page', () => {
    for (const h of HOTSPOTS.filter((h) => h.id.includes('kame') || h.id.includes('omatsu') || h.id.includes('kashi'))) {
      expect(h.hitArea.x).toBeGreaterThan(14000);
      expect(h.hitArea.x + h.hitArea.w).toBeLessThanOrEqual(SCENE_W);
    }
    expect(PAGES.length).toBe(PAGE_SLOTS);
    expect(PAGE_TITLES['p04-kashi']).toBe('河岸の朝');
  });
});

describe('母への文 (catch a walking man)', () => {
  const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);
  const carrying = () => open(open(afterKaze(), 'fumi.found'), 'fumi.carry');

  it('the letter lies on the road only after 風のいたずら, and 伊兵衛 can be stopped only while it is carried', () => {
    expect(spot(newSave(), 'h-fumi')).toBe(false);
    expect(spot(afterKaze(), 'h-fumi')).toBe(true);
    expect(spot(afterKaze(), 'h-ihei')).toBe(false);
    const s = carrying();
    expect(spot(s, 'h-fumi')).toBe(false);
    expect(spot(s, 'h-ihei')).toBe(true);
    expect(questState(s, 'fumi')).toBe('active');
    expect(HOTSPOTS.find((h) => h.id === 'h-ihei')?.walker).toBe('crowd1-merchant');
    expect(nearby(s, 7900)[0]).toMatchObject({ id: 'fumi-carry', spotId: 'h-ihei' });
  });

  it('either word pays 16文 once and leaves its own page', () => {
    for (const [end, comp] of [['ihei.send', 'fumi-send'], ['ihei.rewrite', 'fumi-rewrite']] as const) {
      let s = open(open(carrying(), 'ihei.receive'), end);
      expect(questState(s, 'fumi')).toBe('complete');
      expect(s.wallet.balanceMinor).toBe(72 + 16);
      expect(s.journal.pages.find((p) => p.pageId === 'p05-fumi')?.compositionId).toBe(comp);
      s = open(s, end);
      expect(s.wallet.balanceMinor).toBe(88);
      expect(spot(s, 'h-ihei')).toBe(true); // he still walks by, and remembers
      expect(entryFor('ihei', s)).toBe(end === 'ihei.send' ? 'ihei.done.send' : 'ihei.done.rewrite');
    }
  });

  it('回想 adds the other word as one more page, paying nothing', () => {
    let s = open(open(carrying(), 'ihei.receive'), 'ihei.send');
    s = addRecallPage(s, 'p05-fumi', 'fumi-rewrite');
    expect(s.journal.pages.find((p) => p.pageId === 'p05-fumi-b')?.compositionId).toBe('fumi-rewrite');
    expect(s.wallet.balanceMinor).toBe(88);
  });

  it('「近くのこと」 offers the stories nearest to the player first', () => {
    const s = afterKaze();
    expect(nearby(s, 7900).map((n) => n.id)).toContain('fumi');
    expect(nearby(s, 14700).map((n) => n.id)).toContain('kashi');
    expect(nearby(s, 14700).map((n) => n.id)).not.toContain('fumi');
  });
});

describe('夕暮れの灯 (evening: light three lamps)', () => {
  const evening = () => {
    const s = afterKaze();
    return apply(s, [...questById.get('dougu')!.completionEffects, ...questById.get('tenugui')!.completionEffects]);
  };
  const at = (s: SaveData, t: 'morning' | 'noon' | 'evening') => ({ ...s, settings: { ...s.settings, timeChoice: t } });
  const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);

  it('喜助 asks in the evening only, and only once 夕 is open', () => {
    expect(entryFor('kisuke', afterKaze())).not.toBe('kisuke.yube.ask');
    expect(entryFor('kisuke', evening())).toBe('kisuke.yube.ask'); // auto shows the latest time: 夕
    expect(entryFor('kisuke', at(evening(), 'morning'))).not.toBe('kisuke.yube.ask');
    expect(nearbyAll(at(evening(), 'morning')).find((n) => n.id === 'yube')?.text).toContain('「夕」');
  });

  it('a lamp can be lit only with the flame, in the evening, and once', () => {
    let s = evening();
    expect(spot(s, 'h-lamp2')).toBe(false);
    s = open(open(s, 'kisuke.yube.ask'), 'kisuke.yube.fire');
    expect(spot(s, 'h-lamp2')).toBe(true);
    expect(spot(at(s, 'noon'), 'h-lamp2')).toBe(false);
    expect(nearby(s, 7800).find((n) => n.id === 'yube-light')?.text).toContain('あと3つ');
    s = open(s, 'yube.light2');
    expect(spot(s, 'h-lamp2')).toBe(false);
    expect(nearby(s).find((n) => n.id === 'yube-light')?.text).toContain('あと2つ');
  });

  it('all three lit, either way of ending pays 14文 once and leaves its page', () => {
    for (const [end, comp] of [['yube.tell', 'yube-tell'], ['yube.watch', 'yube-watch']] as const) {
      let s = open(open(evening(), 'kisuke.yube.ask'), 'kisuke.yube.fire');
      for (const n of [1, 2, 3]) s = open(s, `yube.light${n}`);
      expect(entryFor('kisuke', s)).toBe('kisuke.yube.done');
      const before = s.wallet.balanceMinor;
      s = open(open(s, 'kisuke.yube.done'), end);
      expect(questState(s, 'yube')).toBe('complete');
      expect(s.wallet.balanceMinor).toBe(before + 14);
      expect(s.journal.pages.find((p) => p.pageId === 'p06-yube')?.compositionId).toBe(comp);
      s = open(s, end);
      expect(s.wallet.balanceMinor).toBe(before + 14);
      expect(entryFor('kisuke', s)).toBe('kisuke.yube.after');
      expect(entryFor('kisuke', at(s, 'noon'))).toBe('kisuke.done3'); // his day-time words again
    }
  });
});

describe('朝・昼・夕 everyday words', () => {
  it('a person greets differently in the morning and the evening, and closes like the base word', () => {
    let s = open(open(afterKaze(), 'okon.wrapped'), 'okon.entrust');
    s = apply(s, [{ type: 'setFlag', flag: 'okon_seen_done' }]);
    const at = (t: 'morning' | 'noon' | 'evening') => ({ ...s, settings: { ...s.settings, timeChoice: t } });
    expect(entryFor('okon', at('noon'))).toBe('okon.again');
    expect(entryFor('okon', at('morning'))).toBe('okon.again@morning');
    expect(NODES['okon.again@morning'].lines[0].text).toContain('朝');
  });
});

describe('朝の藍 (morning: find three indigo things)', () => {
  const at = (s: SaveData, t: 'morning' | 'noon' | 'evening') => ({ ...s, settings: { ...s.settings, timeChoice: t } });
  const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);

  it('宗吉 asks in the morning once the first page is made; at other times he says to come in the morning', () => {
    expect(entryFor('sokichi', at(afterKaze(), 'morning'))).toBe('sokichi.ai.ask');
    expect(entryFor('sokichi', at(afterKaze(), 'noon'))).not.toBe('sokichi.ai.ask');
    expect(nearbyAll(at(afterKaze(), 'noon')).find((n) => n.id === 'ai')?.text).toContain('「朝」');
    // an old save with the twelve-page book already full still gets the lesson
    const full = apply(at(afterKaze(), 'morning'), [{ type: 'setFlag', flag: 'book_full' }]);
    expect(entryFor('sokichi', full)).toBe('sokichi.ai.ask');
  });

  it('the indigo things can be found only while looking, in the morning, once each', () => {
    let s = open(open(at(afterKaze(), 'morning'), 'sokichi.ai.ask'), 'sokichi.ai.look');
    expect(spot(s, 'h-ai2')).toBe(true);
    expect(spot(at(s, 'noon'), 'h-ai2')).toBe(false);
    s = open(s, 'ai.seen2');
    expect(spot(s, 'h-ai2')).toBe(false);
    expect(nearby(s).find((n) => n.id === 'ai-find')?.text).toContain('あと2つ');
  });

  it('either painting leaves its own page, pays nothing, and 宗吉 remembers', () => {
    for (const [end, comp] of [['ai.vat', 'ai-vat'], ['ai.cloth', 'ai-cloth']] as const) {
      let s = open(open(at(afterKaze(), 'morning'), 'sokichi.ai.ask'), 'sokichi.ai.look');
      for (const n of [1, 2, 3]) s = open(s, `ai.seen${n}`);
      expect(entryFor('sokichi', s)).toBe('sokichi.ai.found');
      const money = s.wallet.balanceMinor;
      s = open(open(s, 'sokichi.ai.found'), end);
      expect(questState(s, 'ai')).toBe('complete');
      expect(s.wallet.balanceMinor).toBe(money);
      expect(s.journal.pages.find((p) => p.pageId === 'p07-ai')?.compositionId).toBe(comp);
      expect(s.progress.familiarity.sokichi?.events).toContain('ai');
      expect(entryFor('sokichi', s)).toBe('sokichi.done');
    }
  });
});

describe('橋のたもと (invite four, draw everyone)', () => {
  const ready = () =>
    apply(afterKaze(), ['dougu', 'tenugui', 'fumi', 'kashi'].flatMap((q) => [{ type: 'setFlag', flag: q === 'fumi' ? 'fumi_send' : q === 'kashi' ? 'kashi_now' : `${q}_x` } as Effect, ...questById.get(q)!.completionEffects]));

  it('宗吉 asks only when the four stories are done', () => {
    expect(entryFor('sokichi', afterKaze())).not.toBe('sokichi.hashi.ask');
    const three = apply(afterKaze(), ['dougu', 'tenugui', 'kashi'].flatMap((q) => questById.get(q)!.completionEffects));
    expect(entryFor('sokichi', three)).not.toBe('sokichi.hashi.ask');
    expect(entryFor('sokichi', ready())).toBe('sokichi.hashi.ask');
    expect(nearby(ready(), 12640).some((n) => n.id === 'hashi')).toBe(true);
  });

  it('each of the four is invited once, then 宗吉 gathers everyone', () => {
    let s = open(open(ready(), 'sokichi.hashi.ask'), 'sokichi.hashi.go');
    expect(entryFor('sokichi', s)).toBe('sokichi.hashi.waiting');
    // nearest first: from the far bank, おまつ
    expect(nearby(s, 14700).find((n) => n.id === 'hashi-invite')?.spotId).toBe('h-omatsu');
    expect(nearby(s).find((n) => n.id === 'hashi-invite')?.text).toContain('あと4人');
    for (const who of ['okon', 'kisuke', 'omatsu', 'ihei']) {
      expect(entryFor(who, s)).toBe(`${who}.hashi`);
      s = open(s, `${who}.hashi`);
      expect(entryFor(who, s)).not.toBe(`${who}.hashi`);
    }
    expect(nearby(s).find((n) => n.id === 'hashi-done')?.spotId).toBe('h-sokichi');
    expect(entryFor('sokichi', s)).toBe('sokichi.hashi.gather');
  });

  it('either picture leaves its own page, pays nothing, and the four remember', () => {
    for (const [end, comp] of [['hashi.with', 'hashi-with'], ['hashi.side', 'hashi-side']] as const) {
      let s = open(open(ready(), 'sokichi.hashi.ask'), 'sokichi.hashi.go');
      for (const who of ['okon', 'kisuke', 'omatsu', 'ihei']) s = open(s, `${who}.hashi`);
      const money = s.wallet.balanceMinor;
      s = open(open(s, 'sokichi.hashi.gather'), end);
      expect(questState(s, 'hashi')).toBe('complete');
      expect(s.wallet.balanceMinor).toBe(money);
      expect(s.journal.pages.find((p) => p.pageId === 'p08-hashi')?.compositionId).toBe(comp);
      for (const who of ['sokichi', 'okon', 'kisuke', 'omatsu', 'ihei']) expect(s.progress.familiarity[who]?.events).toContain('hashi');
      expect(entryFor('sokichi', s)).toBe('sokichi.hashi.after');
      expect(entryFor('okon', s)).not.toBe('okon.hashi');
      expect(nearby(s).some((n) => n.id.startsWith('hashi'))).toBe(false);
    }
  });
});

describe('茶店の猫 (follow the cat, wait beside it)', () => {
  const tenuguiDone = () => apply(afterKaze(), [...questById.get('tenugui')!.completionEffects]);
  const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);

  it('喜助 asks on a later visit, after his thanks for the towel', () => {
    expect(entryFor('kisuke', tenuguiDone())).not.toBe('kisuke.neko.ask');
    const s = apply(tenuguiDone(), ON_CLOSE['kisuke.done3']);
    expect(entryFor('kisuke', s)).toBe('kisuke.neko.ask');
    expect(nearby(s, 11650).some((n) => n.id === 'neko')).toBe(true);
  });

  it('the cat is at one place at a time; a tap sends it on, with a note and no dialogue', () => {
    let s = open(open(apply(tenuguiDone(), ON_CLOSE['kisuke.done3']), 'kisuke.neko.ask'), 'kisuke.neko.go');
    const at = () => ['h-neko1', 'h-neko2', 'h-neko3', 'h-nekohome'].filter((id) => spot(s, id));
    expect(at()).toEqual(['h-neko1']);
    expect(NODES['neko.hop1'].brief).toBe(true);
    s = open(s, entryFor('neko1', s)!);
    expect(at()).toEqual(['h-neko2']);
    expect(nearby(s).find((n) => n.id === 'neko-2')?.spotId).toBe('h-neko2');
    s = open(s, entryFor('neko2', s)!);
    expect(at()).toEqual(['h-neko3']);
    // reaching for it changes nothing; waiting beside it does
    s = open(s, 'neko.reach');
    expect(at()).toEqual(['h-neko3']);
    s = open(s, 'neko.wait');
    expect(at()).toEqual([]);
    expect(entryFor('kisuke', s)).toBe('kisuke.neko.back');
  });

  it('either picture pays 10文 once, leaves its page, and the cat stays by the tea house', () => {
    for (const [end, comp] of [['neko.bench', 'neko-bench'], ['neko.boat', 'neko-boat']] as const) {
      let s = open(open(apply(tenuguiDone(), ON_CLOSE['kisuke.done3']), 'kisuke.neko.ask'), 'kisuke.neko.go');
      for (const n of ['neko.hop1', 'neko.hop2', 'neko.wait', 'kisuke.neko.back']) s = open(s, n);
      const money = s.wallet.balanceMinor;
      s = open(s, end);
      expect(questState(s, 'neko')).toBe('complete');
      expect(s.wallet.balanceMinor).toBe(money + 10);
      expect(open(s, end).wallet.balanceMinor).toBe(money + 10);
      expect(s.journal.pages.find((p) => p.pageId === 'p09-neko')?.compositionId).toBe(comp);
      expect(spot(s, 'h-nekohome')).toBe(true);
      expect(entryFor('kisuke', s)).toBe('kisuke.done3');
      expect(nearby(s).some((n) => n.id.startsWith('neko'))).toBe(false);
    }
  });
});

describe('ご隠居の散歩 (walk with him at his pace)', () => {
  const at = (s: SaveData, t: 'morning' | 'noon' | 'evening') => ({ ...s, settings: { ...s.settings, timeChoice: t } });
  const tenuguiDone = () => apply(afterKaze(), [...questById.get('tenugui')!.completionEffects]);
  const spot = (s: SaveData, id: string) => visibleSpots(s).some((h) => h.id === id);

  it('the elder passer-by can be asked at noon once his towel is back', () => {
    expect(spot(at(afterKaze(), 'noon'), 'h-inkyo')).toBe(false);
    expect(spot(at(tenuguiDone(), 'noon'), 'h-inkyo')).toBe(true);
    expect(spot(at(tenuguiDone(), 'morning'), 'h-inkyo')).toBe(false);
    expect(entryFor('inkyo', at(tenuguiDone(), 'noon'))).toBe('inkyo.ask');
    expect(HOTSPOTS.find((h) => h.id === 'h-inkyo')?.walker).toBe('crowd2-elder');
  });

  it('while walking he is the companion, not the passer-by; a word to him is a note', () => {
    let s = open(open(at(tenuguiDone(), 'noon'), 'inkyo.ask'), 'inkyo.go');
    expect(spot(s, 'h-inkyo')).toBe(false);
    expect(spot(s, 'a-pass-elder')).toBe(false);
    expect(spot(s, 'h-inkyo-walk')).toBe(true);
    expect(entryFor('inkyo', s)).toBe('inkyo.walking');
    expect(NODES['inkyo.walking'].brief).toBe(true);
    expect(nearby(s, 1500).find((n) => n.id === 'inkyo-walk')?.spotId).toBe('a-bench');
    s = apply(s, [{ type: 'setFlag', flag: 'inkyo_arrived' }]);
    expect(spot(s, 'h-inkyo-walk')).toBe(false);
    expect(spot(s, 'h-inkyo-bench')).toBe(true);
    expect(entryFor('inkyo', s)).toBe('inkyo.arrive');
  });

  it('either way of staying leaves its page, pays nothing, and he goes back to his walk', () => {
    for (const [end, comp] of [['inkyo.listen', 'inkyo-listen'], ['inkyo.quiet', 'inkyo-quiet']] as const) {
      let s = apply(open(open(at(tenuguiDone(), 'noon'), 'inkyo.ask'), 'inkyo.go'), [{ type: 'setFlag', flag: 'inkyo_arrived' }]);
      const money = s.wallet.balanceMinor;
      s = open(open(s, 'inkyo.arrive'), end);
      expect(questState(s, 'inkyo')).toBe('complete');
      expect(s.wallet.balanceMinor).toBe(money);
      expect(s.journal.pages.find((p) => p.pageId === 'p10-inkyo')?.compositionId).toBe(comp);
      expect(spot(s, 'h-inkyo-bench')).toBe(false);
      expect(spot(s, 'a-pass-elder')).toBe(true);
      expect(nearby(s, 1500).some((n) => n.id.startsWith('inkyo'))).toBe(false);
    }
  });
});

describe('近くのこと with many stories', () => {
  it('the list shows three; every other offer waits under ほかの頼みごと, none is lost', () => {
    const s = apply(afterKaze(), ['dougu', 'tenugui', 'fumi', 'kashi'].flatMap((q) => questById.get(q)!.completionEffects));
    const all = nearbyAll(s, 12640);
    expect(nearby(s, 12640)).toEqual(all.slice(0, 3));
    for (const id of ['hashi', 'yube', 'ai', 'inkyo', 'sketches']) expect(all.some((n) => n.id === id), id).toBe(true);
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
  });
});

describe('動く人を描く (catch a walking person inside a frame)', () => {
  const at = (s: SaveData, t: 'morning' | 'noon' | 'evening') => ({ ...s, settings: { ...s.settings, timeChoice: t } });
  const aiDone = () => apply(afterKaze(), [{ type: 'setFlag', flag: 'ai_vat' }, ...questById.get('ai')!.completionEffects]);

  it('every passer-by has a frame in the middle of their way, wide enough to catch them', () => {
    for (const [key, u] of Object.entries(UGOKI_PEOPLE)) {
      const f = frameOf(u.walker)!;
      expect(f, key).toBeTruthy();
      expect(f.hi - f.lo, key).toBeGreaterThanOrEqual(90); // 22 units a second: four seconds inside
      const mid = Math.round((f.lo + f.hi) / 2);
      expect(parseUgoki(`ugoki-${key}-${mid}`)?.key).toBe(key);
      expect(parseUgoki(`ugoki-${key}-${f.hi + 200}`), 'outside the frame is not a page').toBeNull();
    }
    expect(parseUgoki('ugoki-merchant-8000')).toBeNull();
  });

  it('宗吉 asks after the morning indigo (not in the morning), then waits', () => {
    expect(entryFor('sokichi', at(afterKaze(), 'noon'))).not.toBe('sokichi.ugoki.ask');
    expect(entryFor('sokichi', at(aiDone(), 'noon'))).toBe('sokichi.ugoki.ask');
    expect(entryFor('sokichi', at(aiDone(), 'morning'))).not.toBe('sokichi.ugoki.ask');
    const s = open(open(at(aiDone(), 'noon'), 'sokichi.ugoki.ask'), 'sokichi.ugoki.go');
    expect(entryFor('sokichi', s)).toBe('sokichi.ugoki.waiting');
    expect(nearby(s, 10780).some((n) => n.id === 'ugoki-catch')).toBe(true);
  });

  it('the catch leaves its page and 宗吉 remembers; no money', () => {
    let s = open(open(at(aiDone(), 'noon'), 'sokichi.ugoki.ask'), 'sokichi.ugoki.go');
    const money = s.wallet.balanceMinor;
    s = apply(s, NODES['ugoki.caught'].effects!);
    expect(questState(s, 'ugoki')).toBe('complete');
    expect(s.wallet.balanceMinor).toBe(money);
    expect(NODES['ugoki.caught'].page).toEqual({ pageId: 'p11-ugoki', compositionId: 'ugoki-{catch}' });
    expect(s.progress.familiarity.sokichi?.events).toContain('ugoki');
    expect(entryFor('sokichi', s)).not.toBe('sokichi.ugoki.waiting');
  });
});
