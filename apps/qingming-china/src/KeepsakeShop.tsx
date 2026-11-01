import { useEffect, useRef, useState } from 'react';
import { JournalArt } from './Art';
import { KEEPSAKES, keepsakePreviewLink, readKeepsakePreview, type Keepsake, type KeepsakePurpose } from './keepsakes';
import { priceLabel } from './commerce';
import { createKeepsakeImage } from './keepsake-export';
import { downloadFile } from './export';
import { prepareShare } from './sharing';
import { study } from './study';

function KeepsakeCard({ item, purpose }: { item: Keepsake; purpose: KeepsakePurpose }) {
  return <svg viewBox="0 0 800 1000" className="keepsake-card" role="img" aria-label={item.title + (purpose === 'gift' ? '赠友样品' : '自用样品')} style={{ color: item.color, fontFamily: 'serif' }}>
    <rect width="800" height="1000" fill="#f0e8d3" />
    <rect x="32" y="32" width="736" height="936" fill="none" stroke="#b4a583" />
    <rect x="42" y="42" width="716" height="916" fill="none" stroke="#c7b999" />
    <text x="400" y="96" fill="#7a806b" fontSize="18" textAnchor="middle">汴河拾光 · 一河烟火，众人相成</text>
    <text x="400" y="174" fill={item.color} fontSize="56" textAnchor="middle">{item.title}</text>
    <ellipse cx="400" cy="393" rx="264" ry="171" fill={item.color} opacity=".06" />
    {item.art === 'lantern' ? <g stroke={item.color} strokeWidth="3" fill="none">
      <path d="M400 232v35m-58 8h116m-101 8q43-22 86 0m-86 0v183q43 22 86 0V283M343 310h114M343 440h114M373 289v175m27-181v186m27-180v175M358 477h84m-42 0v48m-12-12 12 20 12-20" />
      <rect x="350" y="313" width="100" height="124" rx="28" fill="#cba85d" opacity=".18" />
      <path d="M210 548q185 24 380 0m-310 23q109 12 219 0" opacity=".5" />
    </g> : <svg x="140" y="232" width="520" height="330" viewBox="0 0 320 200"><JournalArt kind={item.art} color={item.color} /></svg>}
    <text x="400" y="638" textAnchor="middle" fill="#716b57" fontSize="23">{purpose === 'gift' ? '送给一位惦记的朋友' : '留给自己的一点心意'}</text>
    <text x="400" y="705" textAnchor="middle" fill={item.color} fontSize="27">{item.wish}</text>
    <text x="400" y="788" textAnchor="middle" fill="#89816a" fontSize="17">画中相遇 · {item.story}</text>
    <rect x="364" y="838" width="72" height="50" fill="#9e5740" />
    <text x="400" y="871" textAnchor="middle" fill="#f5ead3" fontSize="25">拾光</text>
    <text x="400" y="925" textAnchor="middle" fill="#676958" fontSize="24">设计样品 · 尚未发售</text>
    <text x="400" y="951" textAnchor="middle" fill="#676958" fontSize="18">不含购买或赠礼权益</text>
  </svg>;
}

export default function KeepsakeShop() {
  const [incoming] = useState(() => readKeepsakePreview(location.href));
  const [item, setItem] = useState(incoming?.item ?? KEEPSAKES[0]);
  const [purpose, setPurpose] = useState<KeepsakePurpose>(incoming?.purpose ?? 'self');
  const [ready, setReady] = useState<{ key: string; blob: Blob } | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [manualLink, setManualLink] = useState(false);
  const [interested, setInterested] = useState(study.has('interest-' + item.product_id));
  const art = useRef<HTMLDivElement>(null);
  const key = item.product_id + ':' + purpose;
  const url = keepsakePreviewLink(item.product_id, purpose, location.href);
  const prepared = ready?.key === key ? ready.blob : null;
  useEffect(() => {
    let active = true;
    setError(''); setReady(null); setMessage(''); setManualLink(false);
    setInterested(study.has('interest-' + item.product_id));
    const svg = art.current?.querySelector('svg');
    if (svg) void createKeepsakeImage(svg).then(blob => { if (active) setReady({ key, blob }); }, () => {
      if (active) setError('样品暂未生成，可以重试。免费画册和进度不受影响。');
    });
    return () => { active = false; };
  }, [key, retry]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting && e.intersectionRatio >= .25)) study.emit('keepsake_previewed', { product_id: item.product_id, purpose }, 'keepsake-' + key);
    }, { threshold: .25 });
    if (art.current) observer.observe(art.current);
    return () => observer.disconnect();
  }, [key]);
  const fields = { product_id: item.product_id, purpose };
  const save = () => {
    if (!prepared) return;
    study.emit('keepsake_export_attempted', fields);
    try {
      downloadFile(prepared, '汴河拾光-' + item.title + (purpose === 'gift' ? '-赠友样品.png' : '-自用样品.png'));
      study.emit('keepsake_export_completed', { ...fields, stage: 'download_requested' });
      setMessage('已生成并请求下载样品，可自行保存或送给朋友；这不是购买凭证。');
    } catch { setMessage('下载请求未完成，可以重试或分享样品链接。'); }
  };
  const share = async () => {
    if (!prepared || busy) return;
    const file = new File([prepared], item.title + '-样品.png', { type: 'image/png' });
    const choice = prepareShare(file, url, '汴河拾光 · ' + item.title + '样品');
    if (!choice) { setMessage('系统分享不可用，可以下载图片或复制样品链接。'); study.emit('keepsake_share_result', { ...fields, result: 'unavailable' }); return; }
    setBusy(true);
    try {
      await navigator.share(choice.data);
      study.emit('keepsake_share_result', { ...fields, result: 'invoked' });
      setMessage(choice.method === 'system_link' ? '已交由系统分享样品链接；仍可另存图片。' : '已交由系统分享样品。');
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === 'AbortError';
      study.emit('keepsake_share_result', { ...fields, result: cancelled ? 'cancelled' : 'failed' });
      setMessage(cancelled ? '已取消分享，样品与进度仍在。' : '分享未完成，可以下载图片或复制样品链接。');
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      study.emit('keepsake_share_result', { ...fields, result: 'copied' });
      setMessage('样品链接已复制，仅在开发演示中有效，不用于领取正式商品。');
    } catch { study.emit('keepsake_share_result', { ...fields, result: 'unavailable' }); setManualLink(true); setMessage('可以长按下方样品链接手动复制，也可以下载图片。'); }
  };
  return <div className="keepsake-shop">
    <p className="section-note">数字纪念品 · 内部样品 · 尚未发售</p>
    <p>一份能留下相遇、也能传递心意的小礼物。拟按一次买断、永久个人使用设计，支持自用或赠友，不自动续费。</p>
    <p className="fine-print">当前只体验设计样品，没有下单或付款。正式赠礼份数与授权范围将在发售前写清；基础故事和画册导出继续免费。</p>
    {!incoming && new URLSearchParams(location.search).has('souvenir') && <p role="status">这份样品链接尚未收录。可以浏览下方样品；未领取任何正式商品。</p>}
    <div className="keepsake-catalogue">{KEEPSAKES.map(product => <button key={product.product_id} className={item.product_id === product.product_id ? 'selected' : ''} aria-pressed={item.product_id === product.product_id} onClick={() => { setItem(product); requestAnimationFrame(() => art.current?.scrollIntoView({ block: 'nearest' })); }}>
      <b>{product.title}</b><span>{product.description}</span><small>{priceLabel(product)}</small>
    </button>)}</div>
    <div className="button-row" role="group" aria-label="纪念品用途">
      <button className="secondary-button" aria-pressed={purpose === 'self'} onClick={() => setPurpose('self')}>留给自己</button>
      <button className="secondary-button" aria-pressed={purpose === 'gift'} onClick={() => setPurpose('gift')}>送给朋友</button>
    </div>
    <div ref={art}><KeepsakeCard item={item} purpose={purpose} /></div>
    {error && <><p role="status">{error}</p><button className="secondary-button" onClick={() => setRetry(n => n + 1)}>重新生成纪念品样品</button></>}
    {!prepared && !error && <p role="status">正在准备纪念品样品……</p>}
    <div className="button-row">
      <button className="primary-button" disabled={!prepared} onClick={save}>下载纪念品样品</button>
      <button className="secondary-button" disabled={!prepared || busy} onClick={() => void share()}>分享纪念品样品</button>
      <button className="secondary-button" onClick={() => void copy()}>复制样品链接</button>
    </div>
    <button className="secondary-button" onClick={() => {
      study.emit('interest_registered', { product_id: item.product_id, offer_version: item.offer_version }, 'interest-' + item.product_id);
      setInterested(true);
    }}>{interested ? '本次兴趣已记下' : '我想要这份纪念品'}</button>
    {interested && <p className="fine-print">只记在本次本机记录中，不是下单，不会收费或发送通知。</p>}
    {message && <p role="status">{message}</p>}
    {manualLink && <label className="manual-link">纪念品样品链接<input value={url} readOnly onFocus={e => e.currentTarget.select()} /></label>}
  </div>;
}
