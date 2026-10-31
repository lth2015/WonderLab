import { describe, expect, it } from 'vitest';
import { ENTRIES, NODES, ON_CLOSE } from '../content/script';
import { characterById, HOTSPOTS, questById, SCENE_W } from '../content/world';
import type { Effect, HotspotDef, SaveData } from '../contract';
import { clampCamera, effectiveArea, isDrag, resolveTap } from './hit';
import { exportText, importText, load, persist, SAVE_KEY } from './save';
import { addPage, apply, newSave, questState, test } from './state';
import { entryFor, nearby, visibleSpots } from './story';

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

describe('script integrity', () => {
  it('every link, entry and close effect names a real node', () => {
    for (const [id, n] of Object.entries(NODES)) {
      if (n.next) expect(NODES[n.next], `${id} → ${n.next}`).toBeDefined();
      for (const c of n.choices ?? []) if (c.next) expect(NODES[c.next], `${id} → ${c.next}`).toBeDefined();
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
    expect(clampCamera(5000, 400, SCENE_W)).toBe(SCENE_W - 400);
    expect(clampCamera(100, 4000, SCENE_W)).toBe(0);
  });

  it('every street target is reachable on a 360 px phone without overlapping a person', () => {
    // scale on a 360 px wide phone (Street.tsx: w / 400)
    const scale = 360 / 400;
    const people = HOTSPOTS.filter((h) => h.kind === 'character');
    for (const p of people) {
      const hits = resolveTap(HOTSPOTS, p.anchor.x, p.anchor.y, scale);
      expect(hits[0]?.targetId, p.id).toBe(p.targetId);
    }
  });
});
