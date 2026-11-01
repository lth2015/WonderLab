import { describe, expect, it } from 'vitest';
import { canCheckout, contentAccess, NIGHT_RETURN, priceLabel, type EntitlementReader, type Product } from './commerce';
import { journalLink } from './links';
import { createStudy } from './study';

describe('content packs and unpublished offers', () => {
  it('never presents an unknown price as free or enables a developing offer', () => {
    expect(priceLabel(NIGHT_RETURN)).toBe('价格待定，尚未发售');
    expect(canCheckout(NIGHT_RETURN, true)).toBe(false);
    // Arbitrary test units; the actual Chinese offer remains unpriced.
    const priced: Product = { ...NIGHT_RETURN, price: { currency: 'USD', amount_minor: 1234, tax_display: 'included' } };
    expect(canCheckout(priced, true)).toBe(false);
    const released: Product = { ...priced, status: 'on_sale', availability: 'public' };
    expect(canCheckout(released, false)).toBe(false);
    expect(canCheckout(released, true)).toBe(true);
    expect(canCheckout({ ...released, price: null }, true)).toBe(false);
    expect(canCheckout({ ...released, price: { ...priced.price!, amount_minor: 0 } }, true)).toBe(false);
    expect(canCheckout({ ...released, status: 'withdrawn' }, true)).toBe(false);
  });
  it('leaves the free world playable even when the entitlement service fails', async () => {
    let calls = 0;
    const failure: EntitlementReader = { read: async () => { calls++; throw new Error('offline'); } };
    expect(await contentAccess('qingming-china-free', failure)).toBe('free');
    expect(calls).toBe(0);
    expect(await contentAccess(NIGHT_RETURN.content_pack_id, failure)).toBe('unavailable');
    for (const status of ['owned', 'unowned', 'unavailable'] as const) {
      const testReader: EntitlementReader = { read: async () => status };
      expect(await contentAccess(NIGHT_RETURN.content_pack_id, testReader)).toBe(status);
    }
    expect(await contentAccess('qingming-edo-paid', { read: async () => 'owned' })).toBe('unavailable');
  });
});

describe('work links contain only public route fields', () => {
  it('drops tokens, state edits and fragments for subpath and root hosting', () => {
    for (const base of ['https://want.world/qingming/', 'https://song.want.world/']) {
      const url = new URL(journalLink('harbor-space', base + '?email=private&wallet=999#invite=secret'));
      expect(url.pathname).toBe(new URL(base).pathname);
      expect([...url.searchParams.keys()]).toEqual(['world', 'scene', 'source']);
      expect(url.searchParams.get('scene')).toBe('harbor');
      expect(url.hash).toBe('');
      expect(url.href).not.toMatch(/private|999|secret|invite/);
    }
  });
  it('uses a configured work URL, rejects unsafe schemes and strips its query', () => {
    expect(journalLink('paper-hands', 'https://want.world/qingming/', 'https://song.want.world/?token=bad#bad')).toBe('https://song.want.world/?world=qingming-china&scene=paper&source=journal');
    for (const bad of ['javascript:alert(1)', 'https://user:pass@example.com/', 'not-a-url']) {
      expect(journalLink('paper-hands', 'https://want.world/qingming/', bad)).toContain('https://want.world/qingming/');
    }
  });
});

describe('local study events', () => {
  it('deduplicates session events and interest but retains separate export attempts', () => {
    const study = createStudy('test', 'test-build');
    for (let i = 0; i < 2; i++) {
      study.emit('world_entered', { source: 'direct' }, 'enter');
      study.emit('interest_registered', { product_id: NIGHT_RETURN.product_id, offer_version: 1 }, 'interest');
      study.emit('journal_export_attempted', { page_id: 'paper-hands', export_type: 'png' });
    }
    expect(study.snapshot().events.map(e => e.type)).toEqual(['world_entered', 'interest_registered', 'journal_export_attempted', 'journal_export_attempted']);
    expect(new Set(study.snapshot().events.map(e => e.event_id)).size).toBe(4);
    expect(study.snapshot().events.every(e => e.environment === 'test')).toBe(true);
  });
  it('drops unapproved fields, rejects raw source text, and isolates failed debug receivers', () => {
    const study = createStudy('test', 'test-build', event => { event.source = 'modified'; throw new Error('debug receiver failed'); });
    const fields = { source: 'direct' as const, email: 'private@example.com', dialogue: 'private words' };
    expect(study.emit('world_entered', fields)).toBe(true);
    expect(study.snapshot().events[0].source).toBe('direct');
    expect(JSON.stringify(study.snapshot())).not.toMatch(/private|email|dialogue/);
    expect(study.emit('world_entered', { source: 'free text' as 'direct' })).toBe(false);
  });
  it('reports truncation instead of silently claiming a complete session', () => {
    const study = createStudy('test', 'test-build');
    for (let i = 0; i < 1002; i++) study.emit('journal_export_attempted', { page_id: 'paper-hands', export_type: 'png' });
    expect(study.snapshot().events).toHaveLength(1000);
    expect(study.snapshot().dropped).toBe(2);
  });
});
