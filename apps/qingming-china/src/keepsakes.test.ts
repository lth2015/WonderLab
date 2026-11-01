import { describe, expect, it } from 'vitest';
import { KEEPSAKES, keepsakePreviewLink, planGiftClaim, readKeepsakePreview, type GiftRecord } from './keepsakes';
import { canCheckout, priceLabel } from './commerce';
import { prepareShare } from './sharing';

const gift: GiftRecord = { gift_id: 'test-gift', world_id: 'qingming-china', product_id: KEEPSAKES[0].product_id, buyer_subject: 'test-buyer', state: 'ready', revision: 1 };
describe('one-time digital keepsakes', () => {
  it('keeps every sample unpriced and unavailable for checkout', () => {
    expect(new Set(KEEPSAKES.map(item => item.product_id)).size).toBe(3);
    for (const item of KEEPSAKES) {
      expect(item.purchase_model).toBe('one_time_buyout');
      expect(item.usage_license).toBe('perpetual_personal');
      expect(item.giftable).toBe(true);
      expect(item.price).toBeNull();
      expect(priceLabel(item)).toBe('价格待定，尚未发售');
      expect(canCheckout(item, true)).toBe(false);
    }
  });
  it('shares only a sample choice, without identity, invitation, order or entitlement fields', () => {
    const url = keepsakePreviewLink(KEEPSAKES[1].product_id, 'gift', 'https://want.world/qingming/?email=private&order=paid&invite=secret#token=secret');
    expect([...new URL(url).searchParams.keys()]).toEqual(['world', 'study', 'souvenir', 'purpose']);
    expect(url).not.toMatch(/private|paid|secret|token/);
    expect(readKeepsakePreview(url)).toEqual({ item: KEEPSAKES[1], purpose: 'gift' });
    expect(readKeepsakePreview(url.replace('purpose=gift', 'purpose=admin'))).toBeNull();
    expect(readKeepsakePreview(url.replace('world=qingming-china', 'world=qingming-edo'))).toBeNull();
    expect(readKeepsakePreview(url.replace(KEEPSAKES[1].product_id, 'unknown'))).toBeNull();
  });
  it('does not allow unpaid, revoked, foreign or malformed gifts to be claimed', () => {
    for (const state of ['unpaid', 'revoked'] as const) expect(planGiftClaim({ ...gift, state }, 'test-friend')).toEqual({ kind: 'unavailable' });
    expect(planGiftClaim({ ...gift, world_id: 'qingming-edo' }, 'test-friend')).toEqual({ kind: 'unavailable' });
    expect(planGiftClaim({ ...gift, revision: -1 }, 'test-friend')).toEqual({ kind: 'unavailable' });
    expect(planGiftClaim(gift, '')).toEqual({ kind: 'unavailable' });
    expect(planGiftClaim({ ...gift, product_id: 'unknown' }, 'test-friend')).toEqual({ kind: 'unavailable' });
  });
  it('plans one recipient grant and idempotent retries; a different recipient gets no second grant', () => {
    const result = planGiftClaim(gift, 'test-friend');
    expect(result.kind).toBe('claim');
    if (result.kind !== 'claim') throw new Error('expected claim plan');
    expect(gift.state).toBe('ready');
    expect(result.next.revision).toBe(2);
    expect(result.license).toBe('perpetual_personal');
    expect(planGiftClaim(result.next, 'test-friend')).toEqual({ kind: 'already_claimed' });
    expect(planGiftClaim(result.next, 'another-friend')).toEqual({ kind: 'unavailable' });
  });
});

describe('system share fallback', () => {
  const file = new File(['sample'], 'sample.png', { type: 'image/png' });
  const url = 'https://want.world/qingming/?scene=paper';
  const share = async () => {};
  it('keeps file sharing where supported', () => {
    expect(prepareShare(file, url, 'title', { share, canShare: () => true })).toEqual({ method: 'system', data: { files: [file], title: 'title', url } });
  });
  it('falls back to system link sharing when files are unsupported or capability probing throws', () => {
    for (const canShare of [() => false, () => { throw new Error('no files'); }]) {
      expect(prepareShare(file, url, 'title', { share, canShare })).toEqual({ method: 'system_link', data: { title: 'title', url } });
    }
    expect(prepareShare(file, url, 'title', {})).toBeNull();
  });
});
