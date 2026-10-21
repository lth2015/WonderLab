import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, newIdempotencyKey } from './api';
import {
  countdown,
  explorerTxUrl,
  formatAtomic,
  knownChainParams,
  parseChainId,
  payStep,
  pollDelayMs,
  secondsLeft,
  toHexChainId,
  walletProblem,
  type WalletProblem,
} from '../lib/stablecoin';
import { useSession } from './session';

// Paying with JPYC or USDC from a browser wallet, after yuha's
// apps/web/src/pages/StablecoinPay.tsx: the same steps and server calls
// (prove the wallet → quote → prepare → send → report → wait), with a
// smaller surface. The amount shown is always the server's quote, rendered
// with the quote's own decimals; the browser never computes a price.

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function injectedProvider(): Eip1193Provider | null {
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum ?? null;
}

interface QuoteResponse {
  orderId: string;
  quoteId: string;
  chainId: number;
  tokenKey: string;
  tokenDecimals: number;
  amountAtomic: string;
  priceJpy: number;
  receiver: string;
  expiresAt: string;
  rateText?: string | null;
}

interface PreparedTransfer {
  to: string;
  data: string;
}

interface PaymentStatusResponse {
  orderStatus: string;
  entitlementGranted: boolean;
}

interface VerifiedWallet {
  address: string;
  chainId: number;
}

const PROBLEM_TEXT: Record<WalletProblem, string> = {
  noWallet: '没有找到浏览器钱包',
  rejected: '钱包里取消了这一步',
  pending: '钱包里还有一个请求等你处理',
  unknownChain: '钱包里还没有 Polygon 网络',
  wrongChain: '请切换到 Polygon 网络',
  insufficientFunds: '钱包余额不足（也需要少量 POL 作手续费）',
  unknown: '钱包没有完成这一步',
};

const SERVER_TEXT: Partial<Record<string, string>> = {
  SERVICE_DISABLED: '钱包支付暂时不可用，请稍后再试或用卡支付',
  CONFLICT: '这个钱包已经绑定在另一个账户上',
  AGE_NOT_CONFIRMED: '请先确认已满 18 岁并同意条款',
  RATE_LIMITED: '稍等片刻再试',
};

export function StablecoinPay({ priceKey, onBack }: { priceKey: string; onBack: () => void }) {
  const { runtime, refresh } = useSession();
  const wantChainId = runtime?.stablecoin.chainId ?? 137;
  const tokens = useMemo(() => runtime?.stablecoin.tokens ?? [], [runtime]);
  const [tokenKey, setTokenKey] = useState(() => tokens[0]?.key ?? 'jpyc');
  const [hasProvider, setHasProvider] = useState(() => injectedProvider() !== null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [verified, setVerified] = useState<VerifiedWallet[]>([]);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  // One key for this purchase attempt: a retried quote is the same order.
  const [idempotencyKey] = useState(() => newIdempotencyKey('scpay'));

  const fail = useCallback((err: unknown) => {
    if (!(err instanceof ApiError)) return setProblem(PROBLEM_TEXT[walletProblem(err)]);
    setProblem(SERVER_TEXT[err.code] ?? err.message);
  }, []);

  useEffect(() => {
    const p = injectedProvider();
    setHasProvider(p !== null);
    if (!p?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const next = (args[0] as string[] | undefined)?.[0];
      setAccount(next ? next.toLowerCase() : null);
      setQuote(null);
      setTxHash(null);
    };
    const onChain = (...args: unknown[]) => setChainId(parseChainId(args[0]));
    p.on('accountsChanged', onAccounts);
    p.on('chainChanged', onChain);
    return () => {
      p.removeListener?.('accountsChanged', onAccounts);
      p.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const loadWallets = useCallback(async () => {
    const res = await apiFetch<{ wallets: VerifiedWallet[] }>('/v1/payments/stablecoin/wallets');
    setVerified(res.wallets.map((w) => ({ ...w, address: w.address.toLowerCase() })));
  }, []);
  useEffect(() => {
    void loadWallets().catch(() => undefined);
  }, [loadWallets]);

  const walletVerified = !!account && verified.some((w) => w.address === account && w.chainId === wantChainId);
  const step = payStep({
    hasProvider,
    account,
    chainId,
    wantChainId,
    walletVerified,
    hasQuote: !!quote,
    reported: !!txHash,
    orderStatus: status?.orderStatus ?? null,
    delivered: !!status?.entitlementGranted,
  });

  useEffect(() => {
    if (!quote || step === 'done') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quote, step]);
  const left = quote ? secondsLeft(quote.expiresAt, now) : 0;
  const expired = !!quote && left === 0 && step !== 'waiting' && step !== 'done';

  // Wait for the chain scan to find the payment and the order to deliver.
  useEffect(() => {
    if (!quote || !txHash || status?.entitlementGranted) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await apiFetch<PaymentStatusResponse>(`/v1/orders/${quote.orderId}/payment-status`);
        if (cancelled) return;
        setStatus(res);
        if (res.entitlementGranted) {
          await refresh();
          return;
        }
      } catch {
        // Keep waiting; the chain is slower than the network.
      }
      if (!cancelled && attempt < 60) timer = setTimeout(tick, pollDelayMs(attempt++));
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [quote, txHash, status?.entitlementGranted, refresh]);

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setProblem('');
    try {
      await fn();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const connect = run(async () => {
    const p = injectedProvider();
    if (!p) return setHasProvider(false);
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[];
    if (!accounts[0]) throw { code: 4001 };
    setAccount(accounts[0].toLowerCase());
    setChainId(parseChainId(await p.request({ method: 'eth_chainId' })));
  });

  const switchChain = run(async () => {
    const p = injectedProvider()!;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHexChainId(wantChainId) }] });
    } catch (err) {
      const chain = knownChainParams(wantChainId);
      if (walletProblem(err) !== 'unknownChain' || !chain) throw err;
      await p.request({ method: 'wallet_addEthereumChain', params: [chain] });
    }
    setChainId(parseChainId(await p.request({ method: 'eth_chainId' })));
  });

  const prove = run(async () => {
    const p = injectedProvider()!;
    const challenge = await apiFetch<{ nonce: string; message: string }>('/v1/payments/stablecoin/wallet-challenge', {
      method: 'POST',
      body: { address: account, chainId: wantChainId },
    });
    const signature = (await p.request({ method: 'personal_sign', params: [challenge.message, account] })) as string;
    await apiFetch('/v1/payments/stablecoin/wallet-verify', {
      method: 'POST',
      body: { nonce: challenge.nonce, address: account, signature },
    });
    await loadWallets();
  });

  const takeQuote = run(async () => {
    const res = await apiFetch<QuoteResponse>('/v1/payments/stablecoin/quote', {
      method: 'POST',
      body: { priceKey, idempotencyKey, tokenKey, payer: account },
    });
    setQuote(res);
    setNow(Date.now());
    setStatus(null);
  });

  const send = run(async () => {
    if (!quote || !account) return;
    const p = injectedProvider()!;
    const prepared = await apiFetch<PreparedTransfer>(`/v1/orders/${quote.orderId}/stablecoin-prepare`, { method: 'POST' });
    const hash = (await p.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: prepared.to, data: prepared.data, value: '0x0' }],
    })) as string;
    setTxHash(hash);
    // Reporting only speeds things up; the scanner finds the payment regardless.
    await apiFetch(`/v1/orders/${quote.orderId}/stablecoin-transaction`, { method: 'POST', body: { txHash: hash } }).catch(() => undefined);
  });

  const label = tokens.find((t) => t.key === (quote?.tokenKey ?? tokenKey))?.label ?? tokenKey.toUpperCase();
  const link = txHash && quote ? explorerTxUrl(quote.chainId, txHash) : null;

  return (
    <div className="scpay">
      {tokens.length > 1 && !quote && (
        <div className="row">
          {tokens.map((t) => (
            <button key={t.key} type="button" className={`text-btn${t.key === tokenKey ? ' primary' : ''}`} onClick={() => setTokenKey(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {step === 'install' && <p className="note">需要浏览器钱包（如 MetaMask）才能用 {label} 支付。</p>}
      {step === 'connect' && (
        <button type="button" className="text-btn primary" disabled={busy} onClick={connect}>
          连接钱包
        </button>
      )}
      {step === 'switch-chain' && (
        <button type="button" className="text-btn primary" disabled={busy} onClick={switchChain}>
          切换到 Polygon
        </button>
      )}
      {step === 'prove' && (
        <>
          <p className="note">先在钱包里签一段文字，证明这个钱包是你的。签名不会花钱。</p>
          <button type="button" className="text-btn primary" disabled={busy} onClick={prove}>
            签名证明
          </button>
        </>
      )}
      {step === 'quote' && (
        <button type="button" className="text-btn primary" disabled={busy} onClick={takeQuote}>
          获取 {label} 报价
        </button>
      )}
      {quote && (step === 'send' || expired) && (
        <>
          <p className="amount">
            {formatAtomic(quote.amountAtomic, quote.tokenDecimals)} {label}
          </p>
          <p className="note">
            {quote.rateText ? `${quote.rateText} · ` : ''}收款地址 {quote.receiver.slice(0, 6)}…{quote.receiver.slice(-4)} ·{' '}
            {expired ? '报价已过期' : `${countdown(left)} 内有效`}
          </p>
          {expired ? (
            <button type="button" className="text-btn primary" disabled={busy} onClick={takeQuote}>
              重新报价
            </button>
          ) : (
            <button type="button" className="text-btn primary" disabled={busy} onClick={send}>
              在钱包中付款
            </button>
          )}
        </>
      )}
      {step === 'waiting' && (
        <p className="note" aria-live="polite">
          已发送，等待链上确认……
          {link && (
            <>
              {' '}
              <a href={link} target="_blank" rel="noreferrer">
                查看交易
              </a>
            </>
          )}
        </p>
      )}
      {step === 'done' && <p className="note">已到账。</p>}
      {problem && <p className="error" role="alert">{problem}</p>}
      <button type="button" className="link-btn" onClick={onBack}>
        返回
      </button>
    </div>
  );
}
