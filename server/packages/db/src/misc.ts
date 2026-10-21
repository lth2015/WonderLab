import type { PoolConnection } from 'mysql2/promise';
import { execute, newId, query, queryOne, toJson } from './pool.js';

// ------------------------------------------------------------------ audit logs

/**
 * Every privileged mutation writes one of these. `reason` is NOT NULL in the
 * schema, so an operator action with no stated reason cannot be recorded at all
 * (UI-15).
 */
export async function writeAuditLog(
  params: {
    actorId: string | null;
    actorRole: string;
    action: string;
    subjectType: string;
    subjectId: string;
    reason: string;
    before?: unknown;
    after?: unknown;
    ipHash?: string | null;
  },
  tx?: PoolConnection,
): Promise<void> {
  await execute(
    `INSERT INTO audit_logs
       (id, actor_id, actor_role, action, subject_type, subject_id, reason, before_state, after_state, ip_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      newId(),
      params.actorId,
      params.actorRole,
      params.action,
      params.subjectType,
      params.subjectId,
      params.reason,
      params.before === undefined ? null : toJson(params.before),
      params.after === undefined ? null : toJson(params.after),
      params.ipHash ?? null,
    ],
    tx,
  );
}

export async function listAuditLogs(params: {
  subjectType?: string;
  subjectId?: string;
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  if (params.subjectType && params.subjectId) {
    return query(
      `SELECT * FROM audit_logs WHERE subject_type = ? AND subject_id = ?
        ORDER BY created_at DESC LIMIT ?`,
      [params.subjectType, params.subjectId, params.limit ?? 100],
    );
  }
  return query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`, [params.limit ?? 100]);
}

// ------------------------------------------------------------------ analytics

/**
 * §11.1: stable id, timestamp, pseudonymous user ref, price version, run mode.
 * Never the raw prompt, the email address or any card data.
 */
export async function trackEvent(
  params: {
    name: string;
    userRef?: string | null;
    props?: Record<string, unknown>;
    priceVersion?: number | null;
    runMode: string;
    isInternal: boolean;
    occurredAt?: Date;
  },
  tx?: PoolConnection,
): Promise<void> {
  await execute(
    `INSERT INTO analytics_events
       (id, name, user_ref, props, price_version, run_mode, is_internal, occurred_at)
     VALUES (?,?,?,?,?,?,?, COALESCE(?, UTC_TIMESTAMP(3)))`,
    [
      newId(),
      params.name,
      params.userRef ?? null,
      toJson(params.props ?? {}),
      params.priceVersion ?? null,
      params.runMode,
      params.isInternal ? 1 : 0,
      params.occurredAt ?? null,
    ],
    tx,
  );
}

// ------------------------------------------------------------ runtime settings

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await queryOne<{ setting_value: T }>(
    `SELECT setting_value FROM runtime_settings WHERE setting_key = ?`,
    [key],
  );
  return row ? row.setting_value : fallback;
}

export async function setSetting(
  params: { key: string; value: unknown; updatedBy: string | null; reason: string },
  tx?: PoolConnection,
): Promise<void> {
  await execute(
    `INSERT INTO runtime_settings (setting_key, setting_value, updated_by, reason)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                             updated_by = VALUES(updated_by),
                             reason = VALUES(reason),
                             updated_at = UTC_TIMESTAMP(3)`,
    [params.key, toJson(params.value), params.updatedBy, params.reason],
    tx,
  );
}

export async function listSettings(): Promise<
  Array<{ key: string; value: unknown; reason: string | null; updated_at: Date }>
> {
  return query(
    `SELECT setting_key AS \`key\`, setting_value AS value, reason, updated_at
       FROM runtime_settings ORDER BY setting_key`,
  );
}
