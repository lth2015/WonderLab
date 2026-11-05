import { useEffect, useRef, useState } from 'react';
import type { SaveData } from '../contract';
import type { Line } from '../content/types';
import { SLIP_PRICE, SLIPS_FOR_SALE, TEA_PRICE } from '../content/shop';
import { characterById, ROLES } from '../content/world';
import { buySlip, buyTea, ownsSlip } from '../engine/shop';
import { study } from '../engine/study';
import { Face } from './Face';
import { Glossed } from './Glossed';
import { Cg } from './Cg';

// 買い物 (spec §11): 喜助's tea and a sweet, 青葉屋's title slips. Paying is a plain, sure step
// (engine/shop.ts): the price is shown on the button, and a light purse simply cannot pay.

const SWATCH: Record<string, string> = { kinsunago: '#e6cf8e', wakakusa: '#b7c48d', sakura: '#efd2d2' };

function Said({ line }: { line: Line }) {
  const who = line.by;
  return (
    <div className="line-body">
      {who !== 'narration' && <Face who={who} />}
      {who !== 'narration' && (
        <p className="speaker">
          {characterById.get(who)?.displayName}
          <small>{ROLES[who]}</small>
        </p>
      )}
      <Glossed className={who === 'narration' ? 'narration' : 'said'} text={line.text} />
    </div>
  );
}

export function Shop({ kind, save, tod, rain, onSave, onToast, onClose }: { kind: 'tea' | 'slips'; save: SaveData; tod: 'morning' | 'noon' | 'evening'; rain: boolean; onSave(s: SaveData): void; onToast(t: string): void; onClose(): void }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [at, setAt] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheet.current?.scrollTo({ top: 0 });
  }, [lines, at]);
  const purse = save.wallet.balanceMinor;

  if (kind === 'tea') {
    const drink = () => {
      const r = buyTea(save);
      if (!r) return;
      onSave(r.save);
      study.emit('play_detail', { what: 'shop', outcome: 'bought' });
      onToast(`${TEA_PRICE}文を払った。`);
      setLines([{ by: 'kisuke', text: 'はいよ、茶と菓子。熱いから気をつけな。' }, { by: 'narration', text: '縁台に腰をおろして、湯気の立つ茶をすする。' }, ...r.moment.lines]);
      setAt(0);
    };
    if (lines) {
      const last = at >= lines.length - 1;
      return (
        <>
        {/* 一服の画: while resting, the view from the bench takes the place of the street */}
        <Cg id="ippuku" tod={tod} rain={rain} />
        <div ref={sheet} className="sheet dialogue shop" role="dialog" aria-live="polite" aria-label="一服">
          <Said line={lines[at]} />
          <button type="button" className="primary next" onClick={last ? onClose : () => setAt(at + 1)} autoFocus>
            {last ? 'ごちそうさま' : '次へ'}
          </button>
        </div>
        </>
      );
    }
    return (
      <div ref={sheet} className="sheet dialogue shop" role="dialog" aria-label="一服">
        <Said line={{ by: 'kisuke', text: `茶と菓子で${TEA_PRICE}文だよ。ひと休みしていくかい？` }} />
        <p className="small">所持金 {purse}文</p>
        <div className="choices">
          <button type="button" className="choice" onClick={drink} disabled={purse < TEA_PRICE}>
            一服する（{TEA_PRICE}文）
          </button>
        </div>
        {purse < TEA_PRICE && <p className="small">文が足りない。頼みごとを手伝うと、文がもらえる。</p>}
        <button type="button" className="ghost" onClick={onClose}>
          またにする
        </button>
      </div>
    );
  }

  const buy = (id: string, label: string) => {
    const next = buySlip(save, id);
    if (!next) return;
    onSave(next);
    study.emit('play_detail', { what: 'shop', outcome: 'bought' });
    onToast(`${SLIP_PRICE}文を払って、${label}を買った。`);
    setLines([{ by: 'seita', text: 'ありがとうございます。絵巻帳の頁を開くと、「題箋を貼りかえる」で貼れますよ。新しく描く頁にも。' }]);
  };
  return (
    <div ref={sheet} className="sheet dialogue shop" role="dialog" aria-label="題箋を見る">
      <Said line={lines?.[0] ?? { by: 'seita', text: `記念の題箋です。一枚${SLIP_PRICE}文。絵巻帳のどの頁にも貼れますよ。` }} />
      <p className="small">所持金 {purse}文</p>
      <ul className="slips">
        {SLIPS_FOR_SALE.map((x) => {
          const owned = ownsSlip(save, x.id);
          return (
            <li key={x.id}>
              <span className={`slip-swatch ${x.id}`} style={{ background: SWATCH[x.id] }} aria-hidden="true" />
              <span className="slip-text">
                <b>{x.label}</b>
                <small>{x.note}</small>
              </span>
              {owned ? (
                <span className="slip-owned">持っている</span>
              ) : (
                <button type="button" onClick={() => buy(x.id, x.label)} disabled={purse < SLIP_PRICE} aria-label={`${x.label}を買う（${SLIP_PRICE}文）`}>
                  買う（{SLIP_PRICE}文）
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {purse < SLIP_PRICE && <p className="small">文が足りない。頼みごとを手伝うと、文がもらえる。</p>}
      <button type="button" className="ghost" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
