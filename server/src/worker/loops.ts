import { describeError } from '@wonderlab/contracts';
import { claimWebhookEvents, expireBatches, reconcileBalances, withTx } from '@wonderlab/db';
import type { AppContext } from '../context.js';
import {
  processWebhookEvent,
  recoverUngrantedOrders,
  reconcilePendingCheckouts,
  reconcileUngrantedSubscriptions,
} from '../services/webhooks.js';
import { expireStaleIntents, runStablecoinScanPass, verifyConfiguredTokens } from '../services/stablecoin-scan.js';
import { needsOperator } from '../services/stablecoin-settle.js';

// Background loops, ported from yuha (apps/worker/src/loops.ts): webhook
// processing, the stablecoin chain scan and the payment/ledger maintenance
// sweeps. Generation, polling, outbox and retention loops are yuha-only and
// were left out. WonderLab runs these inside the API process (worker/index.ts).

export interface LoopDeps {
  ctx: AppContext;
  owner: string;
  log: LoopLog;
  stopped: () => boolean;
}

export type LoopLog = (
  level: 'info' | 'warn' | 'error',
  msg: string,
  fields?: Record<string, unknown>,
) => void;

/**
 * One sweep's failure, kept to that sweep.
 *
 * The eight maintenance sweeps ran inside a single `try`, so a throw anywhere
 * skipped everything after it — and skipped it again every minute, because the
 * input that threw was still there on the next pass. The reachable version is
 * not hypothetical: `reconcilePendingCheckouts` calls `handleCheckoutCompleted`,
 * which throws by design when a charge disagrees with the catalogue, and its
 * query is `ORDER BY created_at`, so one order at the front of the queue
 * silenced the subscription recovery sweep, the retention sweep and the ledger
 * reconciliation for good. Nothing would have said so either: the catch logged
 * `maintenance loop error` without naming the step, and the three alarms that
 * depend on those sweeps read the only thing they could, which is zero.
 *
 * This was a closure inside the loop until a test wanted to inject a throwing
 * sweep and could not reach it — so the fix for a silent, permanent,
 * money-and-compliance failure rested on reading the code.
 * tests/maintenance-isolation.test.ts.
 */
export function isolatedStep(log: LoopLog) {
  return async (name: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (err) {
      log('error', 'maintenance step failed', { step: name, err: describeError(err) });
    }
  };
}

export function makeLogger(component: string) {
  return (level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}) => {
    // Provider and RPC errors can embed credentials in URLs; keep the error, not the URL.
    console.log(JSON.stringify({ level, component, msg, ts: new Date().toISOString(), ...fields }, (_key, value) =>
      typeof value === 'string' ? value.replace(/https?:\/\/[^\s"']+/g, '[redacted-url]') : value,
    ));
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One pass every fifteen seconds; the expiry grace period must exceed it. */
const SCAN_INTERVAL_MS = 15_000;

/**
 * Watches the chain for incoming stablecoin payments.
 *
 * Does nothing at all unless the feature is switched on, which is the shipping
 * state. The pass itself is a pure-ish function over a `DualChainReader` and
 * is tested against fake nodes; this is only the thing that calls it on a
 * timer and builds the reader from configuration.
 *
 * The interval is deliberately unhurried. Polygon finality is 2–5 seconds but
 * nothing here is racing: a customer watching the page sees "waiting for the
 * network", and a scan every fifteen seconds costs a fraction of a free tier
 * where every two seconds would not.
 */
export async function stablecoinScanLoop(deps: LoopDeps): Promise<void> {
  const { ctx, log } = deps;
  if (!ctx.config.STABLECOIN_ENABLED) return;
  const reader = ctx.chain;
  if (!reader) {
    // Configuration refuses to start without both endpoints, so reaching this
    // means the refusal was bypassed rather than that they are optional.
    log('error', 'stablecoin scan not started: two RPC endpoints are required');
    return;
  }
  if (ctx.config.STABLECOIN_RPC_MODE === 'single_secondary') {
    log('warn', 'stablecoin single-provider mode active: Polygon reads trust only the secondary RPC');
  }

  /*
   * Ask the contracts what they are before watching for payments.
   *
   * A wrong address or a mistyped `decimals` in the whitelist is worth a
   * factor of a trillion on every quote, and nothing downstream can notice:
   * the amount is just a number. Refusing to scan is the right failure — the
   * money is not lost, it is simply not being collected, and that is visible.
   *
   * Inside the loop, and retried, which it was not. The check ran once before
   * the loop and `return`ed on ANY problem — including a timeout or a 429 from
   * a public endpoint at the moment the worker happened to boot. One of those
   * permanently stopped the scanner, the quote-expiry sweep and the scan
   * cursor for the life of the process, while the API went on selling. A
   * build whose constants disagree with the chain is a permanent refusal; not
   * being able to ask is a retry. They were the same code path.
   */
  let tokensVerified = false;
  const spanReported = new Map<string, string>();

  while (!deps.stopped()) {
    try {
      if (!tokensVerified) {
        const problems = await verifyConfiguredTokens(ctx, reader).catch((err) => [
          { token: 'chain' as const, kind: 'unavailable' as const, reason: describeError(err) },
        ]);
        for (const p of problems) {
          log('error', 'stablecoin token check failed', { token: p.token, kind: p.kind, reason: p.reason });
        }
        if (problems.some((p) => p.kind === 'mismatch')) {
          log('error', 'stablecoin scan not started: the configured tokens are not what the chain says they are');
          return;
        }
        if (problems.length > 0) {
          log('warn', 'stablecoin scan waiting: the token check could not be completed');
          await sleep(SCAN_INTERVAL_MS);
          continue;
        }
        tokensVerified = true;
      }

      const pass = await runStablecoinScanPass(ctx, reader, log);
      // Said once per change: a node that caps eth_getLogs is now scanned in
      // pieces, which is fine, and worth one line rather than a mystery.
      for (const node of [reader.primary, reader.secondary]) {
        const limit = node.logSpanLimit?.toString() ?? null;
        if (limit !== null && spanReported.get(node.label) !== limit) {
          spanReported.set(node.label, limit);
          log('info', 'stablecoin scan: node caps eth_getLogs, scanning in pieces', { node: node.label, blocks: limit });
        }
      }
      if (pass.found > 0) {
        log('info', 'stablecoin scan pass', {
          fromBlock: pass.window?.fromBlock.toString(),
          toBlock: pass.window?.toBlock.toString(),
          found: pass.found,
          settled: pass.settled.map((s) => s.kind),
          needsOperator: pass.settled.filter(needsOperator).length,
        });
      }

      /*
       * The sweep runs AFTER the scan, not before it.
       *
       * Before, it closed the intent of a quote that had just expired and the
       * scan in the same iteration then found that quote's on-time payment with
       * nothing open to attribute it to. The grace period is the real fix; the
       * ordering is free and removes the worst instance of the race.
       */
      const freed = await expireStaleIntents({ graceSeconds: ctx.config.STABLECOIN_INTENT_GRACE_SECONDS });
      if (freed > 0) log('info', 'stablecoin quotes expired', { intents: freed });
    } catch (err) {
      // Never fatal: an RPC outage must not take the worker down, and the
      // overlap re-read means nothing is lost by missing a pass.
      log('error', 'stablecoin scan pass failed', { err: describeError(err) });
    }
    await sleep(SCAN_INTERVAL_MS);
  }
}

/**
 * Webhook processor.
 *
 * The HTTP handler only verifies and stores; the actual work happens here so a
 * slow grant cannot make Stripe time out and retry (§4.2/PAY-04).
 */
export async function webhookLoop(deps: LoopDeps): Promise<void> {
  const { ctx, log } = deps;
  while (!deps.stopped()) {
    let processed = 0;
    try {
      const events = await withTx(async (tx) => claimWebhookEvents(10, tx));
      for (const ev of events) {
        try {
          await processWebhookEvent(ctx, ev);
          processed += 1;
        } catch (err) {
          log('error', 'webhook processing failed', {
            eventId: ev.event_id,
            type: ev.event_type,
            err: describeError(err),
          });
        }
      }
    } catch (err) {
      log('error', 'webhook loop error', { err: describeError(err) });
    }
    await sleep(processed > 0 ? 100 : 1000);
  }
}

/**
 * Periodic maintenance (§12.3):
 *   - expire credit batches past their validity;
 *   - recover paid orders whose entitlement never landed (PAY-11);
 *   - cross-check the ledger against its derived counters and alert on drift.
 */
export async function maintenanceLoop(deps: LoopDeps, intervalMs = 60_000): Promise<void> {
  const { ctx, log } = deps;

  // One try per sweep, not one around all of them. Why, and what it cost when
  // it was the other way, is at `isolatedStep`.
  const step = isolatedStep(log);

  while (!deps.stopped()) {
    await step('expire-batches', async () => {
      const expired = await expireBatches();
      if (expired) log('info', 'expired entitlement batches', { count: expired });
    });

    await step('recover-ungranted-orders', async () => {
      const recovered = await recoverUngrantedOrders(ctx);
      if (recovered) log('warn', 'recovered paid orders with missing entitlements', { count: recovered });
    });

    /*
     * Orders the provider settled and never told us about. The sweep above
     * cannot see these — it starts from `status = 'paid'`, which an order
     * only reaches because an event said so, and the missing thing here is
     * the event. Ten minutes is well past a normal delivery (seconds) and
     * well inside Stripe's own retry window, so a webhook that is merely
     * slow is never raced.
     *
     * Logged at `warn` even on success: settling by sweep means a delivery
     * was lost, and a silent repair would hide that the endpoint is broken.
     */
    await step('reconcile-pending-checkouts', async () => {
      const reconciled = await reconcilePendingCheckouts(ctx, 600);
      if (reconciled) {
        log('warn', 'settled paid checkouts whose webhook never arrived', { count: reconciled });
      }
    });

    /*
     * Subscribers settled by the sweep above, or by a checkout webhook, still
     * have nothing: their credits come from `invoice.paid`, and the sweep
     * above cannot grant them (PAY-06). Neither could anything else — the
     * PAY-11 sweep skips every product that is not one_time — so a lost
     * invoice meant a subscriber paid monthly and received nothing, forever.
     *
     * `warn` for the same reason as above: reaching this means a delivery was
     * lost, and repairing it quietly would hide that.
     */
    await step('reconcile-ungranted-subscriptions', async () => {
      const subscriptions = await reconcileUngrantedSubscriptions(ctx);
      if (subscriptions) {
        log('warn', 'granted subscription periods whose invoice never arrived', { count: subscriptions });
      }
    });

    await step('reconcile-balances', async () => {
      const drift = await reconcileBalances();
      if (drift.length) {
        // Never auto-corrected: a discrepancy is a bug to investigate, and
        // silently "fixing" it would destroy the evidence.
        log('error', 'ledger reconciliation found discrepancies', {
          count: drift.length,
          batches: drift.slice(0, 5).map((d) => d.batch_id),
        });
      }
    });

    await sleep(intervalMs);
  }
}
