import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listAuditLogs } from '@wonderlab/db';
import type { AppContext } from '../context.js';
import { decideHeldOrder, heldOrderQueue } from '../services/order-review.js';

/**
 * The part of yuha's operations console that payments need (routes/admin.ts):
 * held card orders and the audit log. Stablecoin review lives with the other
 * stablecoin routes. Staff can look; only an admin decides, like every other
 * action about money.
 */
export default async function adminRoutes(app: FastifyInstance, _opts: { ctx: AppContext }) {
  const staff = app.requireRole(['support', 'admin']);
  const adminOnly = app.requireRole(['admin']);

  /**
   * Card orders held before delivery (⑥ in yuha's docs/FRAUD_PREVENTION.md).
   * Releasing hands over what was bought; refusing delivers nothing and leaves
   * the refund to a person in Stripe, which is said plainly rather than
   * implied by a button.
   */
  app.get('/v1/admin/order-reviews', { preHandler: staff }, async () => ({
    items: await heldOrderQueue(),
  }));

  app.post('/v1/admin/order-reviews/:id/decide', { preHandler: adminOnly }, async (req) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ decision: z.enum(['release', 'refuse']), reason: z.string().min(3).max(500) })
      .parse(req.body);
    return decideHeldOrder({
      reviewId: id,
      decision: body.decision,
      reason: body.reason,
      actorId: req.user!.id,
      actorRole: req.user!.role,
    });
  });

  app.get('/v1/admin/audit-logs', { preHandler: staff }, async (req) => {
    const q = z
      .object({ subjectType: z.string().optional(), subjectId: z.string().optional(), limit: z.coerce.number().max(200).default(100) })
      .parse(req.query);
    return { items: await listAuditLogs(q) };
  });
}
