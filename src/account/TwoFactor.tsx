import { useCallback, useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import type { MeView } from '@wonderlab/contracts';
import { ApiError, apiFetch } from './api';
import { useSession } from './session';

// Staff second factor (TOTP), after yuha's apps/web/src/pages/MfaChallenge.tsx
// and the two-factor section of Account.tsx. The server refuses every staff
// route until a factor is enrolled (ADMIN_MFA_REQUIRED); once it is, a staff
// login answers with a challenge instead of a session, and only a code from
// the authenticator (or a one-time recovery code) turns it into one.

const MFA_TEXT: Partial<Record<string, string>> = {
  MFA_INVALID_CODE: '验证码不匹配。验证码每 30 秒变一次，请输入当前那一个，或使用恢复码。',
  MFA_NOT_ENROLLED: '这个账户还没有开启两步验证',
  MFA_REQUIRED: '员工后台需要两步验证，请先在这里开启',
  AUTH_EXCHANGE_FAILED: '这次验证已过期，请重新登录',
  UNAUTHENTICATED: '这次验证已失效，请重新登录',
  CONFLICT: '两步验证已经开启',
  RATE_LIMITED: '稍等片刻再试',
};

export function mfaMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // The per-account lockout shares MFA_INVALID_CODE; only its message tells them apart.
    if (err.code === 'MFA_INVALID_CODE' && err.message.startsWith('too many')) return '错误次数太多，请过几分钟再试';
    return MFA_TEXT[err.code] ?? err.message;
  }
  return '暂时连不上，请稍后再试';
}

/** The code prompt shown in the account sheet while a login waits on it. */
export function MfaChallenge({ challengeToken }: { challengeToken: string }) {
  const { finishLogin, clearChallenge } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ token: string; user: MeView }>('/v1/auth/mfa/verify', {
        method: 'POST',
        body: { challengeToken, code },
      });
      finishLogin(res);
    } catch (err) {
      setError(mfaMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="dev-login" onSubmit={submit} noValidate>
      <p className="note">输入验证器里的 6 位验证码（或一个恢复码），完成登录。</p>
      <label>
        验证码
        {/* Text, not numeric: recovery codes are hex (`a1b2-c3d4`). */}
        <input
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[\s-]/g, ''))}
          placeholder="123456"
          autoFocus
          className="code"
        />
      </label>
      <button type="submit" className="text-btn primary" disabled={busy || code.length < 6}>
        {busy ? '正在验证……' : '验证并登录'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="link-btn" onClick={clearChallenge}>
        重新登录
      </button>
    </form>
  );
}

/** Enrol, confirm and switch off the factor; shown to staff accounts only. */
export function TwoFactor() {
  // null = not answered yet, 'failed' = the status call failed (yuha learned
  // the hard way not to fold the two into one endless "loading").
  const [enabled, setEnabled] = useState<boolean | null | 'failed'>(null);
  const [enrollment, setEnrollment] = useState<{ secret: string; qr: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    apiFetch<{ enabled: boolean }>('/v1/auth/mfa/status')
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled('failed'));
  }, []);
  useEffect(refresh, [refresh]);

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(mfaMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const start = run(async () => {
    const res = await apiFetch<{ secret: string; otpauthUri: string }>('/v1/auth/mfa/enroll', { method: 'POST' });
    const qr = await QRCode.toDataURL(res.otpauthUri, { margin: 1, width: 168 });
    setEnrollment({ secret: res.secret, qr });
    setRecoveryCodes(null);
    setCode('');
  });

  const confirm = run(async () => {
    const res = await apiFetch<{ recoveryCodes: string[] }>('/v1/auth/mfa/confirm', { method: 'POST', body: { code } });
    setRecoveryCodes(res.recoveryCodes);
    setEnrollment(null);
    setCode('');
    setEnabled(true);
  });

  const disable = run(async () => {
    await apiFetch('/v1/auth/mfa/disable', { method: 'POST', body: { code } });
    setEnabled(false);
    setRecoveryCodes(null);
    setCode('');
  });

  return (
    <section className="mfa" aria-labelledby="mfa-title">
      <h3 id="mfa-title">两步验证</h3>
      {enabled === null && <p className="note">……</p>}
      {enabled === 'failed' && (
        <button type="button" className="link-btn" onClick={refresh}>
          没有读到状态，重试
        </button>
      )}
      {enabled === false && !enrollment && (
        <>
          <p className="note">员工后台需要第二重验证：登录后还要输入验证器（如 Google 身份验证器）里的 6 位验证码。</p>
          <button type="button" className="text-btn primary" disabled={busy} onClick={start}>
            {busy ? '准备中……' : '设置两步验证'}
          </button>
        </>
      )}
      {enrollment && (
        <>
          <p className="note">1. 用验证器扫描二维码，或手动输入密钥：</p>
          <img className="qr" src={enrollment.qr} width={168} height={168} alt="两步验证的二维码" />
          <code className="key">{enrollment.secret}</code>
          <p className="note">2. 输入验证器里当前的 6 位验证码：</p>
          <div className="row">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-label="验证码"
              className="code"
            />
            <button type="button" className="text-btn primary" disabled={busy || code.length !== 6} onClick={confirm}>
              确认并启用
            </button>
          </div>
        </>
      )}
      {recoveryCodes && (
        <div className="recovery" role="status">
          <p className="note">已开启。请立即保存这 {recoveryCodes.length} 个恢复码，它们只显示这一次；手机丢失时，每个码可以用一次。</p>
          <ul>
            {recoveryCodes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {enabled === true && !recoveryCodes && <p className="note">已开启：登录时需要输入验证器中的验证码。</p>}
      {enabled === true && (
        <div className="row">
          <input
            type="text"
            autoComplete="one-time-code"
            maxLength={12}
            placeholder="验证码或恢复码"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[\s-]/g, ''))}
            aria-label="用于关闭两步验证的验证码"
            className="code"
          />
          <button type="button" className="link-btn" disabled={busy || code.length < 6} onClick={disable}>
            关闭两步验证
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
