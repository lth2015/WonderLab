import { AppError, type UserRole } from '@wonderlab/contracts';
import { findByExternalId, type UserRow } from '@wonderlab/db';
import type { AppConfig } from '../config.js';
import { SessionTokenIssuer } from './tokens.js';

export interface AuthPrincipal {
  userId: string;
  email: string;
  role: UserRole;
  ageConfirmed: boolean;
  /** Which adapter authenticated this request; recorded in audit entries. */
  authProvider: string;
}

export interface AuthAdapter {
  readonly kind: string;
  /** Verifies a bearer token and returns the local user. */
  verify(token: string): Promise<UserRow>;
}

/**
 * Development identity for demo mode.
 *
 * Issues an HMAC-signed opaque session via the shared token issuer, so the
 * local flow exercises real bearer auth rather than a "pretend I am user X"
 * header. `loadConfig` refuses to construct this in production (SEC-03), and
 * every user it creates is stored with auth_provider = 'dev', keeping the two
 * identity spaces permanently distinguishable.
 */
export class DevAuthAdapter implements AuthAdapter {
  readonly kind = 'dev';
  private readonly issuer: SessionTokenIssuer;

  constructor(params: { secret: string; ttlSeconds?: number }) {
    this.issuer = new SessionTokenIssuer(params.secret, params.ttlSeconds);
  }

  issue(params: { externalId: string; email: string }): { token: string; expiresAt: Date } {
    return this.issuer.issue({ provider: 'dev', externalId: params.externalId, email: params.email });
  }

  async verify(token: string): Promise<UserRow> {
    const claims = this.issuer.verify(token, 'dev');
    if (!claims) throw new AppError('UNAUTHENTICATED', 'invalid or expired dev session token');

    /*
     * Look up only. Creating here undoes an erasure.
     *
     * This used to fall through to `upsertUser`, which looked harmless: the
     * dev-login route upserts before it issues a token, so the row always
     * exists for a real session. It is reachable in exactly one case — the row
     * is gone — and that case is account deletion. `anonymiseUser` rotates
     * `external_id` so a later sign-in starts a fresh account, which means the
     * lookup above misses, which means the fall-through would INSERT a new
     * active user carrying the email out of the still-valid token. Tokens last
     * seven days, so for a week after an erasure the person's own browser
     * would write their address back and keep its API access.
     *
     * `GoogleSessionAdapter` below has always done it this way, with the
     * reason in its comment. Dev now agrees with it.
     */
    const existing = await findByExternalId('dev', claims.sub);
    if (!existing) throw new AppError('UNAUTHENTICATED', 'session no longer maps to an account');
    return existing;
  }
}

/**
 * Session side of the Google adapter: the OAuth dance lives in ./google.ts and
 * the auth routes; this part turns the session token minted at the end of it
 * back into a user row. No auto-create on verify — a deleted Google account's
 * session dies with the row.
 */
export class GoogleSessionAdapter implements AuthAdapter {
  readonly kind = 'google';
  private readonly issuer: SessionTokenIssuer;

  constructor(params: { secret: string }) {
    this.issuer = new SessionTokenIssuer(params.secret);
  }

  sessionIssuer(): SessionTokenIssuer {
    return this.issuer;
  }

  async verify(token: string): Promise<UserRow> {
    const claims = this.issuer.verify(token, 'google');
    if (!claims) throw new AppError('UNAUTHENTICATED', 'invalid or expired session token');
    const user = await findByExternalId('google', claims.sub);
    if (!user) throw new AppError('UNAUTHENTICATED', 'session no longer maps to an account');
    return user;
  }
}

export function createAuthAdapter(cfg: AppConfig): AuthAdapter {
  switch (cfg.adapters.auth) {
    case 'google':
      return new GoogleSessionAdapter({ secret: googleSessionSecret(cfg) });
    default:
      return new DevAuthAdapter({ secret: cfg.DEV_AUTH_SECRET! });
  }
}

/**
 * Google sessions are signed with the same class of secret as dev sessions.
 * A deployment that has not set one refuses to boot rather than signing with
 * a default value.
 */
export function googleSessionSecret(cfg: AppConfig): string {
  const secret = cfg.GOOGLE_SESSION_SECRET ?? cfg.DEV_AUTH_SECRET;
  if (!secret) {
    throw new AppError(
      'SERVICE_DISABLED',
      'GOOGLE_SESSION_SECRET (or DEV_AUTH_SECRET outside production) is required for google auth',
    );
  }
  return secret;
}

export { GoogleAuthAdapter, isGoogleConfigured } from './google.js';
export { SessionTokenIssuer } from './tokens.js';
