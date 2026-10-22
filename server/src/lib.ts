/**
 * Library entry point (as yuha's apps/api/src/lib.ts): the config, context,
 * server and the payment services, for tests and scripts. Importing this
 * starts nothing.
 */
export { loadConfig, baseFeatures, ConfigError, type AppConfig, type FeatureFlags } from './config.js';
export { createContext, type AppContext } from './context.js';
export { buildServer } from './app.js';
export { STRIPE_WEBHOOK_PATHS, STRIPE_WEBHOOK_PRIMARY_PATH, keepsRawBody } from './webhook-paths.js';
export { parseDevLoginAllowlist, devLoginAllowed, type DevLoginAllowlist } from './auth/allowlist.js';
export { createAuthAdapter, DevAuthAdapter, devExternalId, type AuthAdapter } from './auth/index.js';

export {
  createCheckout,
  getOrderView,
  getEntitlements,
  cancelSubscription,
  listProducts,
  grantTrialIfEligible,
  toJst,
} from './services/billing.js';

export {
  processWebhookEvent,
  recoverUngrantedOrders,
  reconcilePendingCheckouts,
  reconcileUngrantedSubscriptions,
} from './services/webhooks.js';

export {
  assertConfiguredTokensVerified,
  expireStaleIntents,
  resetTokenGateForTests,
  runStablecoinScanPass,
  SCAN_STREAM,
  verifyConfiguredTokens,
} from './services/stablecoin-scan.js';
export { needsOperator, type SettleOutcome } from './services/stablecoin-settle.js';
