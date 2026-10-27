import type { FastifyInstance } from 'fastify';
import type { RuntimeInfo } from '@wonderlab/contracts';
import { toDisplayAddress } from '@wonderlab/providers';
import { baseFeatures, type AppConfig } from '../config.js';
import type { AppContext } from '../context.js';
import { freeTrialAvailable } from '../services/billing.js';
import { enabledStablecoinTokens } from '../services/stablecoin-tokens.js';

/**
 * Public, unauthenticated endpoints, ported from yuha (routes/public.ts): the
 * runtime descriptor and the legal disclosure block. They answer without a
 * database too, so the page can always ask what is switched on.
 */
export default async function publicRoutes(app: FastifyInstance, opts: { config: AppConfig; ctx: AppContext | null }) {
  const { config, ctx } = opts;

  app.get('/ready', async (request, reply) => {
    if (!ctx) return { status: 'ready', accounts: false };
    try {
      const { query } = await import('@wonderlab/db');
      await query('SELECT 1');
      return { status: 'ready', accounts: true };
    } catch (err) {
      request.log.warn({ err }, 'readiness database check failed');
      return reply.status(503).send({ status: 'not-ready', reason: (err as Error).message });
    }
  });

  /**
   * What this deployment actually is. The web app renders the demo banner and
   * hides unavailable features from this, so the interface can never claim a
   * capability the running configuration does not have.
   */
  app.get('/v1/runtime', async () => {
    const features = ctx ? await ctx.features() : baseFeatures(config);
    const trialAvailable = ctx ? await freeTrialAvailable(ctx) : false;
    const googleConfigured = !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI);
    const info: RuntimeInfo = {
      mode: config.mode,
      demo: config.isDemo,
      accountsEnabled: !!ctx,
      features: {
        subscriptionsEnabled: features.subscriptionsEnabled,
        // Not `features.freeTrialEnabled`: that flag is only half the
        // condition the grant applies. See `freeTrialAvailable`.
        freeTrialEnabled: trialAvailable,
        freeTrialUnits: trialAvailable ? config.FREE_TRIAL_UNITS : 0,
        realPaymentsEnabled: features.realPaymentsEnabled,
        cardPaymentsEnabled: !!ctx && features.cardPaymentsEnabled,
        qrWalletsEnabled: config.STRIPE_WALLETS_ENABLED,
      },
      adapters: {
        auth: config.adapters.auth,
        payments: ctx ? ctx.payments.kind : 'none',
      },
      stablecoin: {
        enabled: !!ctx && config.STABLECOIN_ENABLED,
        chainId: config.STABLECOIN_CHAIN_ID,
        /*
         * From the whitelist, filtered by the switches — never a literal
         * written again here. The scanner's filter and the verifier's lookup
         * drifting apart would mean watching one contract and accepting
         * another; the same applies to what the browser is told to pay.
         */
        tokens: ctx
          ? enabledStablecoinTokens(config).map((t) => ({
              key: t.key,
              address: toDisplayAddress(t.address),
              decimals: t.decimals,
              label: t.label,
            }))
          : [],
      },
      // Publishable key only. A secret key never reaches the browser (SEC-06).
      stripePublishableKey: config.STRIPE_PUBLISHABLE_KEY ?? null,
      legalEntityConfigured: config.legalEntityConfigured,
      authMethods: {
        dev: !!ctx && config.adapters.auth === 'dev',
        google: !!ctx && (config.adapters.auth === 'google' || googleConfigured),
        googleConfigured,
        cognito: false,
      },
    };
    return info;
  });

  /**
   * 特定商取引法 disclosure. The unconfigured fallback is a visible
   * placeholder, never a real party's details (yuha SEC-13); production
   * refuses to start without the real values when accounts are on.
   */
  app.get('/v1/legal/business-disclosure', async () => ({
    configured: config.legalEntityConfigured,
    isPlaceholder: !config.legalEntityConfigured,
    entityName: config.LEGAL_ENTITY_NAME ?? 'Wonderful World (operator not configured)',
    representative: config.LEGAL_ENTITY_REPRESENTATIVE ?? '(not configured)',
    contact: config.LEGAL_ENTITY_CONTACT ?? '(not configured)',
    phone: config.LEGAL_ENTITY_PHONE ?? '—',
    notice: config.legalEntityConfigured
      ? null
      : 'Company details shown from configuration defaults. Before real charging, replace with the registered legal-entity block (name, representative, contact) and counsel-reviewed terms.',
  }));
}
