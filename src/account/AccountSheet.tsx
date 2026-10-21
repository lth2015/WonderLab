import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MeView, OrderView, ProductView } from '@wonderlab/contracts';
import { GOOGLE_WEB_RETURN_PATH } from '../../server/src/auth/google-paths';
import { API_BASE, ApiError, apiFetch, newIdempotencyKey } from './api';
import { canBePaid, firstAvailableMethod, paymentMethodsOf } from '../lib/purchase';
import { AUTH_NEXT_KEY, safeInternalPath } from '../lib/paths';
import { useSession } from './session';
import { StablecoinPay } from './StablecoinPay';

// The account panel: sign-in, credits and buying, opened from 更多. It is a
// sheet over the canvas rather than a page, so the world keeps breathing
// behind it (docs/01 P6). The flows are yuha's (apps/web/src/pages/Auth.tsx,
// Checkout.tsx); the surface is WonderLab's.

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

function messageOf(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'AGE_NOT_CONFIRMED') return '请先确认已满 18 岁并同意条款';
    if (err.code === 'RATE_LIMITED') return '稍等片刻再试';
    return err.message;
  }
  return '暂时连不上，请稍后再试';
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { runtime, me, loading } = useSession();
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let body;
  if (loading) body = <p className="note">……</p>;
  else if (!runtime?.accountsEnabled) body = <p className="note">账户功能尚未开启。画画、写字都不需要账户。</p>;
  else if (!me) body = <SignIn />;
  else if (!me.ageConfirmed) body = <Consent />;
  else body = <Signed me={me} />;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet account" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <h2 id="account-title">账户</h2>
        {runtime?.demo && runtime.accountsEnabled && <p className="demo-note">演示环境：登录与付款都是模拟的</p>}
        {body}
        <button ref={closeBtn} type="button" className="text-btn" onClick={onClose}>
          回到湖边
        </button>
      </div>
    </>
  );
}

function SignIn() {
  const { runtime, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const google = () => {
    // Come back to the lake after Google (yuha keeps `next` the same way).
    try {
      sessionStorage.setItem(AUTH_NEXT_KEY, '/?account');
    } catch {
      // Private mode: the return lands on the plain lake instead.
    }
    location.href = `${API_BASE}/v1/auth/google/start`;
  };

  const devLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ token: string; user: MeView }>('/v1/auth/dev-login', {
        method: 'POST',
        body: { email, ageConfirmed: true, termsAccepted: true, marketingOptIn: false },
      });
      signIn(res.token, res.user);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {runtime?.authMethods.google && (
        <button type="button" className="text-btn primary" onClick={google}>
          用 Google 登录
        </button>
      )}
      {runtime?.authMethods.dev && (
        <form className="dev-login" onSubmit={devLogin}>
          <label>
            邮箱（开发登录，无需密码）
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label className="check">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> 我已满 18 岁
          </label>
          <label className="check">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> 我同意使用条款
          </label>
          <button type="submit" className="text-btn" disabled={busy || !age || !terms}>
            登录
          </button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}

/** Google sign-in never sets age and terms; purchases need both (yuha UI-02). */
function Consent() {
  const { refresh } = useSession();
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/v1/me/consent', { method: 'POST', body: { ageConfirmed: true, termsAccepted: true, marketingOptIn: false } });
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };
  return (
    <form className="dev-login" onSubmit={submit}>
      <p className="note">购买之前，请确认：</p>
      <label className="check">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} /> 我已满 18 岁
      </label>
      <label className="check">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> 我同意使用条款
      </label>
      <button type="submit" className="text-btn" disabled={!age || !terms}>
        确认
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function Signed({ me }: { me: MeView }) {
  const { signOut } = useSession();
  const [products, setProducts] = useState<ProductView[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  // One key per product per opening of the panel: a double tap is one order.
  const keys = useRef(new Map<string, string>());

  useEffect(() => {
    apiFetch<{ items: ProductView[] }>('/v1/products')
      .then((r) => setProducts(r.items))
      .catch((err) => setError(messageOf(err)));
  }, []);

  const buy = async (p: ProductView) => {
    const method = firstAvailableMethod(p);
    if (method !== 'card') return;
    let key = keys.current.get(p.priceKey);
    if (!key) {
      key = newIdempotencyKey();
      keys.current.set(p.priceKey, key);
    }
    setBusy(p.priceKey);
    setError('');
    try {
      const res = await apiFetch<{ orderId: string; checkoutUrl: string; simulated: boolean }>('/v1/checkout', {
        method: 'POST',
        body: { priceKey: p.priceKey, idempotencyKey: key, successPath: '/checkout/complete', cancelPath: '/?account' },
      });
      location.href = res.checkoutUrl;
    } catch (err) {
      setError(messageOf(err));
      setBusy(null);
    }
  };

  if (wallet) return <StablecoinPay priceKey={wallet} onBack={() => setWallet(null)} />;

  return (
    <>
      <p className="who">
        {me.email}
        <br />
        <span className="credits">余墨 {me.creditsAvailable}</span>
      </p>
      {products === null && !error && <p className="note">……</p>}
      {products && products.length === 0 && <p className="note">暂无可购买的内容。</p>}
      {products && products.length > 0 && (
        <ul className="products">
          {products.map((p) => {
            const methods = paymentMethodsOf(p);
            const card = methods.find((m) => m.method === 'card');
            const coin = methods.some((m) => m.method !== 'card' && m.available);
            return (
              <li key={p.priceKey}>
                <div>
                  <strong>{p.displayName}</strong>
                  <span className="meta">
                    {p.units} 墨{p.validityDays ? ` · ${p.validityDays} 天内有效` : ''}
                    {p.autoRenew ? ' · 每月' : ''}
                  </span>
                </div>
                <div className="row">
                  {card?.available && (
                    <button type="button" className="text-btn" disabled={!canBePaid(p) || busy !== null} onClick={() => buy(p)}>
                      {busy === p.priceKey ? '……' : `${yen(p.amountMinor)} 购买`}
                    </button>
                  )}
                  {coin && (
                    <button type="button" className="text-btn" disabled={busy !== null} onClick={() => setWallet(p.priceKey)}>
                      用钱包付
                    </button>
                  )}
                  {!canBePaid(p) && <span className="meta">暂不可购买</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="link-btn" onClick={signOut}>
        退出登录
      </button>
    </>
  );
}

/** After Google: exchange the one-time code for a session (yuha GoogleCallback.tsx). */
export function useGoogleReturn(onDone: (next: string) => void): string {
  const { signIn } = useSession();
  const [state, setState] = useState('');
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || location.pathname !== GOOGLE_WEB_RETURN_PATH) return;
    tried.current = true;
    const code = new URLSearchParams(location.search).get('code');
    let next = '/?account';
    try {
      next = safeInternalPath(sessionStorage.getItem(AUTH_NEXT_KEY)) ?? next;
      sessionStorage.removeItem(AUTH_NEXT_KEY);
    } catch {
      // Keep the default.
    }
    if (!code) {
      setState(new URLSearchParams(location.search).get('google_error') ? '登录没有完成' : '');
      onDone(next);
      return;
    }
    setState('正在完成登录……');
    apiFetch<{ token: string; user: MeView }>('/v1/auth/google/exchange', { method: 'POST', body: { code } })
      .then((res) => {
        signIn(res.token, res.user);
        setState('');
        onDone(next);
      })
      .catch((err) => setState(messageOf(err)));
  }, [signIn, onDone]);
  return state;
}

/** Back from checkout: wait for the server to confirm the payment (yuha Checkout.tsx). */
export function CheckoutComplete({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { refresh } = useSession();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const poll = async () => {
      try {
        const o = await apiFetch<OrderView>(`/v1/orders/${encodeURIComponent(orderId)}`);
        if (!alive) return;
        setOrder(o);
        if (o.entitlementGranted) {
          await refresh();
          return;
        }
      } catch (err) {
        if (alive) setError(messageOf(err));
        return;
      }
      // The webhook usually lands in seconds; give it a minute before saying so.
      if (++tries < 30 && alive) window.setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      alive = false;
    };
  }, [orderId, refresh]);

  let text = '正在确认付款……';
  if (error) text = error;
  else if (order?.entitlementGranted) text = `已到账：${order.displayName ?? ''}`;
  else if (order?.heldForReview) text = '付款已收到，正在人工确认，稍后到账。';
  else if (order && order.status !== 'paid' && order.status !== 'pending') text = '这笔订单没有完成。';
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet account" role="dialog" aria-modal="true" aria-label="付款结果">
        <h2>付款</h2>
        <p className="note" aria-live="polite">
          {text}
        </p>
        <button type="button" className="text-btn" onClick={onClose}>
          回到湖边
        </button>
      </div>
    </>
  );
}

/** Demo only: the simulated checkout page the API points at (yuha's /checkout/simulate). */
export function SimulatedCheckout({ onClose }: { onClose: () => void }) {
  const q = new URLSearchParams(location.search);
  const sessionId = q.get('session_id') ?? '';
  const orderId = q.get('order_id') ?? '';
  const amount = Number(q.get('amount') ?? 0);
  const [error, setError] = useState('');
  const settle = async (outcome: 'paid' | 'failed') => {
    try {
      await apiFetch('/v1/dev/simulate-payment', { method: 'POST', body: { sessionId, outcome } });
      location.replace(`/checkout/complete?order_id=${encodeURIComponent(orderId)}`);
    } catch (err) {
      setError(messageOf(err));
    }
  };
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet account" role="dialog" aria-modal="true" aria-label="模拟付款">
        <h2>模拟付款</h2>
        <p className="note">演示环境，不会产生真实扣款。金额 {yen(amount)}</p>
        <div className="row">
          <button type="button" className="text-btn primary" onClick={() => settle('paid')}>
            付款成功
          </button>
          <button type="button" className="text-btn" onClick={() => settle('failed')}>
            付款失败
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </>
  );
}
