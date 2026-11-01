import type { Product } from './commerce';

export type KeepsakeId = 'qingming-china-keepsake-peace' | 'qingming-china-keepsake-light' | 'qingming-china-keepsake-tea';
export type KeepsakePurpose = 'self' | 'gift';
export type Keepsake = Product & {
  product_id: KeepsakeId; purchase_model: 'one_time_buyout'; usage_license: 'perpetual_personal'; giftable: true;
  art: 'willow' | 'lantern' | 'tea'; color: string; story: string; wish: string;
};
const base = { world_id: 'qingming-china', status: 'development', availability: 'internal', offer_version: 1, price: null, purchase_model: 'one_time_buyout', usage_license: 'perpetual_personal', giftable: true } as const;
export const KEEPSAKES: readonly Keepsake[] = [
  { ...base, product_id: 'qingming-china-keepsake-peace', content_pack_id: 'qingming-china-keepsake-peace-v1', title: '平安纸签', description: '把“有人盼你平安”的心意，留给自己，也送给远行的朋友。', story: '针脚里的牵挂', wish: '愿你走得再远，也有一处盼你平安。', art: 'willow', color: '#66765b' },
  { ...base, product_id: 'qingming-china-keepsake-light', content_pack_id: 'qingming-china-keepsake-light-v1', title: '同行灯笺', description: '为归途留一点光，让朋友知道：不必一个人走完这一程。', story: '桥边留一盏 · 概念试样', wish: '愿你的归途，总有一盏为你留的灯。', art: 'lantern', color: '#9a734c' },
  { ...base, product_id: 'qingming-china-keepsake-tea', content_pack_id: 'qingming-china-keepsake-tea-v1', title: '茶暖小笺', description: '记住对方的一点偏好，邀他在忙碌之后坐下来，喝一盏温茶。', story: '一席知味', wish: '愿你忙碌之后，也有一席温茶。', art: 'tea', color: '#826c5b' },
];

export function readKeepsakePreview(current: string): { item: Keepsake; purpose: KeepsakePurpose } | null {
  const query = new URL(current).searchParams;
  if (query.get('study') !== 'souvenirs' || query.get('world') !== 'qingming-china') return null;
  const item = KEEPSAKES.find(item => item.product_id === query.get('souvenir'));
  const purpose = query.get('purpose');
  return item && (purpose === 'self' || purpose === 'gift') ? { item, purpose } : null;
}
/** A public sample reference, never a purchase proof or gift redemption token. */
export function keepsakePreviewLink(id: KeepsakeId, purpose: KeepsakePurpose, current: string): string {
  if (!KEEPSAKES.some(item => item.product_id === id) || !['self', 'gift'].includes(purpose)) throw new Error('unknown sample');
  const url = new URL('./', current);
  url.searchParams.set('world', 'qingming-china'); url.searchParams.set('study', 'souvenirs');
  url.searchParams.set('souvenir', id); url.searchParams.set('purpose', purpose);
  return url.toString();
}

export interface GiftRecord {
  gift_id: string; world_id: string; product_id: string; buyer_subject: string;
  state: 'unpaid' | 'ready' | 'claimed' | 'revoked'; recipient_subject?: string; revision: number;
}
export type ClaimPlan = { kind: 'claim'; next: GiftRecord; license: 'perpetual_personal' } | { kind: 'already_claimed' | 'unavailable' };
/** Server-side rule proposal only. Commit with CAS/transaction and authenticated identity.
 * Not imported by the shop UI; it never grants access from a sample link. */
export function planGiftClaim(record: GiftRecord, authenticatedRecipient: string): ClaimPlan {
  if (!authenticatedRecipient.trim() || !record.gift_id || !record.buyer_subject || !Number.isSafeInteger(record.revision) || record.revision < 0 || record.world_id !== 'qingming-china' || !KEEPSAKES.some(item => item.product_id === record.product_id)) return { kind: 'unavailable' };
  if (record.state === 'claimed') return { kind: record.recipient_subject === authenticatedRecipient ? 'already_claimed' : 'unavailable' };
  if (record.state !== 'ready') return { kind: 'unavailable' };
  return { kind: 'claim', next: { ...record, state: 'claimed', recipient_subject: authenticatedRecipient, revision: record.revision + 1 }, license: 'perpetual_personal' };
}
export interface KeepsakeGiftService {
  /** Server resolves catalogue price; never take a client amount. */
  createCheckout(productId: KeepsakeId, purpose: KeepsakePurpose, idempotencyKey: string): Promise<{ checkout_url: string }>;
  /** Only a server-verified purchase can issue a gift. Quantity policy is server-owned. */
  prepareGift(verifiedPurchaseId: string, idempotencyKey: string): Promise<{ claim_url: string }>;
  /** Uses the authenticated session; token is opaque, server-generated and single-use. */
  claimGift(token: string): Promise<'claimed' | 'already_claimed' | 'unavailable'>;
  restore(): Promise<readonly { product_id: KeepsakeId; license: 'perpetual_personal' }[]>;
}
