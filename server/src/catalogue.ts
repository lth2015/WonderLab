import { z } from 'zod';
import type { AppConfig } from './config.js';

/*
 * What WonderLab sells comes from configuration, not code.
 *
 * yuha hard-coded its four products here (drop_5, pro_monthly,
 * premier_monthly, market_license). WonderLab's founder has not decided what
 * to sell or at what price, so the rows are read from CATALOGUE_JSON and
 * nothing is on sale until that is set. The shape is yuha's row shape, and
 * the rest of yuha's rules still hold:
 *
 *   - the server resolves amount, currency and Stripe price from the key; a
 *     client-supplied amount is never trusted (PAY-01);
 *   - a price change is a new `version`, never an edit, so existing orders
 *     and subscriptions keep the price they were sold at;
 *   - the Stripe price id is read from STRIPE_PRICE_ID_<PRICE_KEY>, a derived
 *     name, so no second list can fall out of step with this one.
 *
 * Example (yen, tax included):
 *   CATALOGUE_JSON=[{"price_key":"ink_10","version":1,"kind":"one_time",
 *     "display_name":"墨 · 10","amount_minor":500,"units":10,"validity_days":180}]
 */

const row = z
  .object({
    price_key: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, 'lowercase letters, digits and _'),
    version: z.number().int().positive(),
    kind: z.enum(['one_time', 'subscription']),
    display_name: z.string().min(1).max(80),
    /** Tax-inclusive, in yen. */
    amount_minor: z.number().int().positive(),
    units: z.number().int().positive(),
    validity_days: z.number().int().positive().nullable().default(null),
  })
  .strict()
  .transform((r) => ({
    ...r,
    auto_renew: r.kind === 'subscription',
    billing_interval: r.kind === 'subscription' ? ('month' as const) : null,
    /** What this is called in the Stripe dashboard. */
    stripeProduct: r.display_name,
  }));

export type CatalogueRow = z.infer<typeof row>;

/** Parse CATALOGUE_JSON; throws with a readable message when it is malformed. */
export function parseCatalogue(json: string | undefined): CatalogueRow[] {
  if (!json || !json.trim()) return [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('not valid JSON');
  }
  const parsed = z.array(row).safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const keys = new Set<string>();
  for (const r of parsed.data) {
    if (r.kind === 'subscription' && r.validity_days !== null) throw new Error(`${r.price_key}: a subscription has no validity_days`);
    if (keys.has(r.price_key)) throw new Error(`${r.price_key} appears twice; a new price is a new version of one row`);
    keys.add(r.price_key);
  }
  return parsed.data;
}

/** The catalogue with each row's Stripe price id, as yuha's catalogue() returned it. */
export function catalogue(config: AppConfig) {
  return config.catalogue.map((r) => ({ ...r, stripe_price_id: config.stripePriceIds[r.price_key] ?? null }));
}

/** The same rows, shaped for a Stripe price check (kept from yuha for a future checker). */
export function cataloguePrices(config: AppConfig) {
  return catalogue(config).map((r) => ({
    priceKey: r.price_key,
    displayName: r.stripeProduct,
    amountMinor: r.amount_minor,
    currency: 'jpy' as const,
    interval: r.billing_interval,
    taxIncluded: true as const,
    envVar: `STRIPE_PRICE_ID_${r.price_key.toUpperCase()}`,
    priceId: r.stripe_price_id,
  }));
}
