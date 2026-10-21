import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import type { AppContext } from '../context.js';
import { maintenanceLoop, makeLogger, stablecoinScanLoop, webhookLoop, type LoopDeps } from './loops.js';

/**
 * Start the payment loops inside the API process (yuha runs them as a
 * separate worker; WonderLab is small enough for one). Returns a stop
 * function that resolves when the loops have finished their current pass.
 */
export function startWorker(ctx: AppContext): () => Promise<void> {
  const log = makeLogger('worker');
  // Identifies this process in leases, so a crashed process's claims are
  // recognisably its own and are re-claimed once the lease expires.
  const owner = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  let stopping = false;
  const deps: LoopDeps = { ctx, owner, log, stopped: () => stopping };
  log('info', 'worker starting', { owner, mode: ctx.config.mode, payments: ctx.payments.kind });
  const loops = [webhookLoop(deps), maintenanceLoop(deps), stablecoinScanLoop(deps)];
  return async () => {
    stopping = true;
    await Promise.allSettled(loops);
  };
}
