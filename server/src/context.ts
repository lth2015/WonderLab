import {
  SimulatedPaymentsAdapter,
  StripePaymentsAdapter,
  type PaymentsAdapter,
  ChainNode,
  DualChainReader,
  httpTransport,
  readCoinbaseUsdJpy,
  readFrankfurterUsdJpy,
  type RateObservation,
} from '@wonderlab/providers';
import { getSetting, initDb } from '@wonderlab/db';
import { baseFeatures, type AppConfig, type FeatureFlags } from './config.js';

// The shared context, ported from yuha (apps/api/src/context.ts) with only
// what accounts and payments need: no music, text, storage, queue or email.

export interface UsdJpySource {
  /** The rate a USDC quote is computed from. */
  primary(): Promise<RateObservation>;
  /** An independent reading the primary must agree with. Never priced from. */
  reference(): Promise<RateObservation>;
}

export interface AppContext {
  config: AppConfig;
  payments: PaymentsAdapter;
  chain: DualChainReader | undefined;
  fx: UsdJpySource;
  features(): Promise<FeatureFlags>;
}

function buildPayments(cfg: AppConfig): PaymentsAdapter {
  if (cfg.adapters.payments === 'simulated') {
    return new SimulatedPaymentsAdapter({
      signingSecret: cfg.DEV_AUTH_SECRET ?? 'wonderlab-dev-only',
      checkoutBaseUrl: `${cfg.PUBLIC_WEB_URL}/checkout/simulate`,
    });
  }
  return new StripePaymentsAdapter({
    secretKey: cfg.STRIPE_SECRET_KEY!,
    webhookSecret: cfg.STRIPE_WEBHOOK_SECRET!,
    expectLiveMode: cfg.mode === 'production',
    ...(cfg.STRIPE_API_VERSION ? { apiVersion: cfg.STRIPE_API_VERSION } : {}),
  });
}

function buildChainReader(cfg: AppConfig): DualChainReader | undefined {
  if (!cfg.POLYGON_RPC_PRIMARY_URL || !cfg.POLYGON_RPC_SECONDARY_URL) return undefined;
  return new DualChainReader(
    new ChainNode(httpTransport({ label: 'polygon-primary', url: cfg.POLYGON_RPC_PRIMARY_URL })),
    new ChainNode(httpTransport({ label: 'polygon-secondary', url: cfg.POLYGON_RPC_SECONDARY_URL })),
    cfg.STABLECOIN_RPC_MODE,
  );
}

/** Requires DATABASE_URL (config.accountsEnabled). */
export function createContext(config: AppConfig): AppContext {
  if (!config.DATABASE_URL) throw new Error('createContext needs DATABASE_URL');
  initDb({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    ssl: config.DATABASE_SSL,
  });

  const statics = baseFeatures(config);

  return {
    config,
    payments: buildPayments(config),
    chain: buildChainReader(config),
    fx: {
      primary: () => readCoinbaseUsdJpy(),
      reference: () => readFrankfurterUsdJpy(),
    },
    async features(): Promise<FeatureFlags> {
      const overrides = await getSetting<Partial<Record<keyof FeatureFlags, boolean>>>(
        'feature_overrides',
        {},
      );
      return {
        subscriptionsEnabled: statics.subscriptionsEnabled && overrides.subscriptionsEnabled !== false,
        freeTrialEnabled: statics.freeTrialEnabled && overrides.freeTrialEnabled !== false,
        realPaymentsEnabled: statics.realPaymentsEnabled,
        cardPaymentsEnabled: statics.cardPaymentsEnabled,
      };
    },
  };
}
