export type Price = { currency: string; amount_minor: number; tax_display: 'included' | 'excluded' | 'pending' };
export type Product = {
  product_id: string; world_id: 'qingming-china'; content_pack_id: string;
  status: 'development' | 'preview' | 'on_sale' | 'withdrawn'; title: string; description: string;
  offer_version: number; price: Price | null; availability: 'internal' | 'public';
};
export const NIGHT_RETURN: Product = {
  product_id: 'qingming-china-night-return', world_id: 'qingming-china', content_pack_id: 'qingming-china-night-return-v1',
  status: 'development', title: '汴河夜归', description: '收摊后的河岸，给还未到家的人留一盏灯。',
  offer_version: 1, price: null, availability: 'internal',
};
export const CONTENT_PACKS = [
  { id: 'qingming-china-free', version: 2, access: 'free', scenes: ['paper', 'bridge', 'tea', 'harbor'], stories: ['paper', 'boat', 'purse', 'harbor'], dependencies: [], art_status: 'existing-original-art', rights_status: 'see-existing-asset-register' },
  { id: NIGHT_RETURN.content_pack_id, version: 1, access: 'preview', scenes: ['night-landing'], stories: ['night-lantern'], dependencies: ['qingming-china-free'], art_status: 'reused-daylight-study-not-final', rights_status: 'commercial-release-review-pending' },
] as const;
export function priceLabel(product: Product): string {
  if (!product.price || !Number.isSafeInteger(product.price.amount_minor) || product.price.amount_minor <= 0) return '价格待定，尚未发售';
  try {
    const formatter = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: product.price.currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const tax = product.price.tax_display === 'included' ? '含税' : product.price.tax_display === 'excluded' ? '未含税' : '税费待确认';
    return formatter.format(product.price.amount_minor / 10 ** digits) + '（' + tax + '）' + (product.status === 'on_sale' ? '' : '，尚未发售');
  } catch { return '价格待定，尚未发售'; }
}
/** A future adapter still needs a trusted server catalogue and verified payment. */
export function canCheckout(product: Product, releaseEnabled: boolean): boolean {
  return releaseEnabled && product.status === 'on_sale' && product.availability === 'public' && !!product.price
    && /^[A-Z]{3}$/.test(product.price.currency) && Number.isSafeInteger(product.price.amount_minor) && product.price.amount_minor > 0 && product.price.tax_display !== 'pending';
}
export type Access = 'owned' | 'unowned' | 'unavailable';
export interface EntitlementReader { read(contentPackId: string): Promise<Access> }
export async function contentAccess(contentPackId: string, reader: EntitlementReader): Promise<'free' | Access> {
  if (contentPackId === 'qingming-china-free') return 'free';
  if (!CONTENT_PACKS.some(p => p.id === contentPackId)) return 'unavailable';
  try {
    const access = await reader.read(contentPackId);
    return ['owned', 'unowned', 'unavailable'].includes(access) ? access : 'unavailable';
  } catch { return 'unavailable'; }
}
