import { useEffect, useRef, useState } from 'react';
import { NIGHT_RETURN, priceLabel } from './commerce';
import { study } from './study';

/** A playable concept study; no entitlement claim and no writes to the free save. */
export function NightStudy({ placement }: { placement: 'album' | 'summary' }) {
  const root = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState(false);
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState('');
  const [interested, setInterested] = useState(study.has('interest-night-v1'));
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting && e.intersectionRatio >= 0.5)) {
        study.emit('offer_viewed', { product_id: NIGHT_RETURN.product_id, offer_version: NIGHT_RETURN.offer_version, placement }, 'offer-night-v1-' + placement);
      }
    }, { threshold: 0.5 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [placement]);
  const interest = () => {
    study.emit('interest_registered', { product_id: NIGHT_RETURN.product_id, offer_version: NIGHT_RETURN.offer_version }, 'interest-night-v1');
    setInterested(true);
  };
  return <section className="night-study" ref={root} aria-label="汴河夜归内部概念试样">
    <p className="section-note">内部概念试样 · 开发中 · {priceLabel(NIGHT_RETURN)}</p>
    <h3>{NIGHT_RETURN.title}</h3><p>{NIGHT_RETURN.description}</p>
    <p className="fine-print">拟议续篇：3—5 段新故事，当前仅有下方的一段交互小样。画面复用白日素材试调夜色，尚非正式续篇美术。</p>
    {!opened ? <button className="secondary-button" onClick={() => setOpened(true)}>试走一段《桥边留一盏》</button> : <div className="night-scene">
      <img src={`${import.meta.env.BASE_URL}art/china/scroll/scroll-00.webp`} alt="复用现有河岸画面作夜色试样" />
      <h4>桥边留一盏</h4>
      {step === 0 && <><p>收摊的灯匠正要收起最后两盏灯。河面传来桨声，还有人未到家。</p><button className="primary-button" onClick={() => setStep(1)}>问问哪里还需要光</button></>}
      {step === 1 && <><p>「石阶临水，转弯处也暗。」两盏灯放在哪里，能让晚归的人看清脚下？</p><div className="button-row"><button className="secondary-button" onClick={() => setHint('桥面虽亮了，下船的石阶仍看不清。再看看两处暗的地方。')}>都留在桥面</button><button className="primary-button" onClick={() => { setHint(''); setStep(2); }}>一盏照石阶，一盏照弯道</button></div></>}
      {step === 2 && <><p>船近了。灯匠点点头：「等脚步走稳，再收最后一盏。」</p><button className="primary-button" onClick={() => {
        setStep(3);
        if (!study.emit('story_completed', { story_id: 'night-lantern', first_completion: true }, 'night-story-first')) {
          study.emit('story_completed', { story_id: 'night-lantern', first_completion: false });
        }
      }}>等船靠稳，再一道收灯</button></>}
      {step === 3 && <><p>晚归的人踏上石阶，回头道了声谢。灯匠把温着的灯交到你手上：「回去的路，也给自己留一点光。」</p><div className="night-page"><b>试样画页 · 给归人留光</b><p>我把两盏灯分到石阶与弯道，等脚步走稳，才收起最后一盏。</p></div><p className="fine-print">这是概念试样，不向免费画册发页或文钱，不代表已购买续篇。</p><button className="secondary-button" onClick={() => { setStep(0); setHint(''); }}>再走一遍</button></>}
      {hint && <p role="status">{hint}</p>}
      <button className="secondary-button" onClick={() => setOpened(false)}>收起小样</button>
    </div>}
    <button className="secondary-button" onClick={interest}>{interested ? '本次兴趣已记下' : '我想继续逛'}</button>
    {interested && <p role="status">只记在本次本机体验记录中，尚未发售；这不是下单，也不会发送通知。刷新后不会保留兴趣记录。</p>}
  </section>;
}
