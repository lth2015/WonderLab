import { describe, expect, it } from 'vitest';
import { MOMENTS, SLIP_PRICE, TEA_PRICE } from '../content/shop';
import { NODES } from '../content/script';
import { questById, SLIPS_FOR_SALE, TITLE_STYLE_IDS } from '../content/world';
import type { SaveData } from '../contract';
import { exportText, importText } from './save';
import { buySlip, buyTea, nextMoment, ownsSlip, retitle, slipStyles } from './shop';
import { addPage, apply, hasFlag, newSave } from './state';

const done = (s: SaveData, ...q: string[]) => apply(s, q.flatMap((x) => questById.get(x)!.completionEffects));

describe('買い物', () => {
  it('prices are the spec values: 茶と菓子 6文, 記念の題箋 12文', () => {
    expect(TEA_PRICE).toBe(6);
    expect(SLIP_PRICE).toBe(12);
  });

  it('喜助 offers tea and 清太 the slips, beside 少し話す', () => {
    expect(NODES['kisuke.done3'].choices!.map((c) => c.shop ?? (c.talk ? 'talk' : ''))).toEqual(['talk', 'tea']);
    for (const id of ['seita.done', 'seita.again']) expect(NODES[id].choices!.some((c) => c.shop === 'slips')).toBe(true);
    // his evening word after 夕暮れの灯 too
    expect(NODES['kisuke.yube.after'].choices!.map((c) => c.shop ?? (c.talk ? 'talk' : ''))).toEqual(['talk', 'tea']);
    // the morning and evening words carry the same choices
    for (const id of Object.keys(NODES).filter((k) => k.startsWith('kisuke.done3@'))) expect(NODES[id].choices!.some((c) => c.shop === 'tea')).toBe(true);
  });

  it('a rest costs 6文, shows each helped person once, then a quiet moment', () => {
    let s = done(newSave(), 'kaze', 'dougu', 'tenugui');
    const before = s.wallet.balanceMinor;
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = buyTea(s)!;
      seen.push(r.moment.id);
      s = r.save;
    }
    expect(seen).toEqual(['kaze', 'kinji', 'oharu', 'quiet', 'quiet']);
    expect(s.wallet.balanceMinor).toBe(before - 5 * TEA_PRICE);
    // a story finished later brings its moment
    s = done(s, 'kashi');
    expect(nextMoment(s).id).toBe('kame');
  });

  it('a light purse cannot pay, and nothing changes', () => {
    const s = { ...newSave(), wallet: { ...newSave().wallet, balanceMinor: 5 } };
    expect(buyTea(s)).toBeNull();
    expect(buySlip({ ...s, wallet: { ...s.wallet, balanceMinor: 11 } }, 'sakura')).toBeNull();
  });

  it('every moment names a real story', () => {
    for (const m of MOMENTS) expect(JSON.stringify(m.when)).toMatch(/"quest":"\w+"/);
  });

  it('a slip is bought once, then can go on any page; the save keeps it', () => {
    let s = done(newSave(), 'kaze');
    s = addPage(s, { pageId: 'p01-kaze', compositionId: 'kaze-hands-near', titleStyle: 'plain', madeAt: new Date().toISOString() });
    expect(slipStyles(s).map((x) => x.id)).toEqual(['plain', 'indigo', 'vermilion']);
    expect(retitle(s, 'p01-kaze', 'sakura')).toBe(s); // not owned yet
    const money = s.wallet.balanceMinor;
    s = buySlip(s, 'sakura')!;
    expect(ownsSlip(s, 'sakura')).toBe(true);
    expect(s.wallet.balanceMinor).toBe(money - 12);
    expect(buySlip(s, 'sakura')).toBeNull(); // once
    expect(buySlip(s, 'nope')).toBeNull();
    s = retitle(s, 'p01-kaze', 'sakura');
    expect(s.journal.pages[0].titleStyle).toBe('sakura');
    const r = importText(exportText(s));
    expect(r.ok && r.save.journal.pages[0].titleStyle).toBe('sakura');
    expect(r.ok && hasFlag(r.save, 'slip_sakura')).toBe(true);
    for (const x of SLIPS_FOR_SALE) expect(TITLE_STYLE_IDS).toContain(x.id);
  });
});
