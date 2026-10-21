import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MeView, RuntimeInfo } from '@wonderlab/contracts';
import { apiFetch, getToken, SESSION_EXPIRED_EVENT, setToken } from './api';

// The signed-in state, after yuha's apps/web/src/lib/session.tsx: what the
// deployment offers (/v1/runtime) and who is signed in (/v1/me). Accounts are
// optional in WonderLab — without an API database `runtime.accountsEnabled`
// is false and the account panel says so; the canvas never depends on this.

interface Session {
  runtime: RuntimeInfo | null;
  me: MeView | null;
  loading: boolean;
  signIn(token: string, me: MeView): void;
  /**
   * Finish a first-factor login (dev or Google). A staff account with a
   * second factor gets a challenge instead of a session; the account sheet
   * then asks for the code.
   */
  finishLogin(res: LoginResult): void;
  /** The pending second-factor challenge, if a login is waiting on one. */
  challenge: string | null;
  clearChallenge(): void;
  signOut(): void;
  /** Re-read the account, e.g. after a purchase landed. */
  refresh(): Promise<void>;
}

export type LoginResult = { token: string; user: MeView } | { mfaRequired: true; challengeToken: string };

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [me, setMe] = useState<MeView | null>(null);
  const [loading, setLoading] = useState(true);
  // In memory only: the challenge lives five minutes and dies with the tab.
  const [challenge, setChallenge] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      setMe(await apiFetch<MeView>('/v1/me'));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rt = await apiFetch<RuntimeInfo>('/v1/runtime');
        if (!alive) return;
        setRuntime(rt);
        if (rt.accountsEnabled) await refresh();
      } catch {
        // No API at all (a static build, or the server is off): accounts simply aren't there.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const onExpired = () => setMe(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      alive = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [refresh]);

  const signIn = useCallback((token: string, user: MeView) => {
    setToken(token);
    setMe(user);
  }, []);

  const finishLogin = useCallback(
    (res: LoginResult) => {
      if ('mfaRequired' in res) return setChallenge(res.challengeToken);
      setChallenge(null);
      signIn(res.token, res.user);
    },
    [signIn],
  );
  const clearChallenge = useCallback(() => setChallenge(null), []);

  const signOut = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ runtime, me, loading, signIn, finishLogin, challenge, clearChallenge, signOut, refresh }),
    [runtime, me, loading, signIn, finishLogin, challenge, clearChallenge, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}
