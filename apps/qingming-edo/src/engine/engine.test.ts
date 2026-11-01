import { describe, expect, it } from 'vitest';
import { ENTRIES, NODES, ON_CLOSE, RECALL_START } from '../content/script';
import { FALLBACK, TALK_CLOSE, TALK_TOPICS } from '../content/talk';
import { characterById, HOTSPOTS, PAGE_SLOTS, PAGE_TITLES, PAGES, questById, questOfPage, SCENE_W, parseSketch, SKETCHES, sketchPageId } from '../content/world';
import type { Effect, HotspotDef, SaveData } from '../contract';
import { clampCamera, effectiveArea, isDrag, resolveTap } from './hit';
import { exportText, importText, load, persist, SAVE_KEY } from './save';
import { addPage, addRecallPage, apply, hasFlag as hasFlagFn, newSave, questState, test } from './state';
import { entryFor, nearby, visibleSpots } from './story';
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
  it('no story waits on the time of day', () => {
    // every entry rule reads flags and quests only, never the time
    expect(JSON.stringify(ENTRIES)).not.toMatch(/morning|noon|evening|timeChoice/);
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
    for (const c of characterById.values()) expect(c.isChild).toBe(false); // none yet; revisit when one is added
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
    s = apply(s, [...questById.get('dougu')!.completionEffects, ...questById.get('tenugui')!.completionEffects]);
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
