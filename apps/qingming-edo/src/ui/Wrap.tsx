import { useRef, useState } from 'react';
import { WRAP_ITEMS, type WrapMark } from '../content/world';

// 包みを整える (spec §10): put each of three goods on the cloth with its mark,
// then fold, then tie. Drag, or tap the item and then the cloth. A wrong cloth
// sends the item back; after two misses in a row a hint can be shown. No timer,
// first time 30–60 s. Marks are shown as a picture and in words.

const INK = '#514d3e';

export function Mark({ mark, size = 28 }: { mark: WrapMark; size?: number }) {
  const s = { fill: 'none', stroke: '#3d5677', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      {mark === 'wave' && <path d="M 3 16 q 3.5 -6 7 0 t 7 0 t 7 0 M 3 22 q 3.5 -6 7 0 t 7 0 t 7 0" {...s} />}
      {mark === 'diamond' && <path d="M 14 3 L 25 14 L 14 25 L 3 14 Z M 14 9 L 19 14 L 14 19 L 9 14 Z" {...s} />}
      {mark === 'circle' && (
        <>
          <circle cx={14} cy={14} r={10} {...s} />
          <circle cx={14} cy={14} r={4} {...s} />
        </>
      )}
    </svg>
  );
}

function Good({ id }: { id: string }) {
  const l = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' as const };
  return (
    <svg width={64} height={40} viewBox="0 0 64 40" aria-hidden="true">
      {id === 'bento' && (
        <>
          <rect x={8} y={10} width={48} height={24} rx={4} fill="#5a1f17" {...l} />
          <rect x={6} y={6} width={52} height={10} rx={3} fill="#8c2f22" {...l} />
          <path d="M 12 11 h 40" stroke="#c9a45c" strokeWidth={1} />
        </>
      )}
      {id === 'hashi' && (
        <>
          <rect x={4} y={14} width={56} height={12} rx={3} fill="#2c2420" {...l} />
          <path d="M 8 20 h 48" stroke="#a25540" strokeWidth={1.2} />
        </>
      )}
      {id === 'toishi' && <path d="M 10 30 L 16 12 L 52 12 L 56 30 Z" fill="#9a968a" {...l} />}
    </svg>
  );
}

type Step = 'match' | 'fold' | 'tie' | 'done';

export function Wrap({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  // cloths in a fixed shuffled order, so the answer is never "same position"
  const cloths: WrapMark[] = ['circle', 'wave', 'diamond'];
  const [placed, setPlaced] = useState<Record<string, WrapMark>>({});
  const [held, setHeld] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState(false);
  const [note, setNote] = useState('品を選んで、同じ印の布に置いてください。');
  const [step, setStep] = useState<Step>('match');
  const [shake, setShake] = useState<string | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);

  const itemOf = (id: string) => WRAP_ITEMS.find((i) => i.id === id)!;

  const tryPlace = (id: string, cloth: WrapMark) => {
    const it = itemOf(id);
    if (Object.values(placed).includes(cloth)) return;
    if (it.mark === cloth) {
      const next = { ...placed, [id]: cloth };
      setPlaced(next);
      setHeld(null);
      setMisses(0);
      setHint(false);
      if (Object.keys(next).length === WRAP_ITEMS.length) {
        setStep('fold');
        setNote('三つとも、印の合う布に収まりました。');
      } else setNote(`${it.label}を${it.markLabel}の布に置きました。`);
    } else {
      setShake(id);
      setTimeout(() => setShake(null), 400);
      setHeld(null);
      setMisses((m) => m + 1);
      setNote(`印が違うようです。${it.label}は元に戻しました。`);
    }
  };

  const onItemDown = (e: React.PointerEvent, id: string) => {
    if (placed[id]) return;
    drag.current = { id, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onItemMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
    if (d.moved) setGhost({ id: d.id, x: e.clientX, y: e.clientY });
  };
  const onItemUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d) return;
    if (!d.moved) {
      setHeld((h) => (h === d.id ? null : d.id));
      setNote(`${itemOf(d.id).label}を手に取りました。置く布を選んでください。`);
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cloth]') as HTMLElement | null;
    if (el) tryPlace(d.id, el.dataset.cloth as WrapMark);
  };

  const hintFor = held ?? WRAP_ITEMS.find((i) => !placed[i.id])?.id ?? null;

  return (
    <div className="panel wrap" role="dialog" aria-labelledby="wrap-h">
      <h2 id="wrap-h">包みを整える</h2>
      <p className="wrap-note" aria-live="polite">
        {note}
      </p>

      {step === 'match' && (
        <>
          <h3>品</h3>
          <ul className="goods">
            {WRAP_ITEMS.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  className={`good${shake === it.id ? ' shake' : ''}`}
                  aria-pressed={held === it.id}
                  disabled={!!placed[it.id]}
                  onPointerDown={(e) => onItemDown(e, it.id)}
                  onPointerMove={onItemMove}
                  onPointerUp={onItemUp}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHeld((h) => (h === it.id ? null : it.id));
                    }
                  }}
                >
                  <Good id={it.id} />
                  <span>{it.label}</span>
                  <span className="mark-tag">
                    <Mark mark={it.mark} size={20} />
                    {it.markLabel}
                  </span>
                  {placed[it.id] && <small>置きました</small>}
                </button>
              </li>
            ))}
          </ul>
          <h3>包みの布</h3>
          <ul className="cloths">
            {cloths.map((c) => {
              const item = WRAP_ITEMS.find((i) => placed[i.id] === c);
              const isHint = hint && hintFor && itemOf(hintFor).mark === c;
              return (
                <li key={c}>
                  <button
                    type="button"
                    data-cloth={c}
                    className={`cloth${isHint ? ' hinted' : ''}`}
                    disabled={!!item}
                    onClick={() => held && tryPlace(held, c)}
                    aria-label={`${WRAP_ITEMS.find((i) => i.mark === c)!.markLabel}の布${item ? `（${item.label}）` : ''}`}
                  >
                    <Mark mark={c} size={34} />
                    <span>{WRAP_ITEMS.find((i) => i.mark === c)!.markLabel}</span>
                    {item && <Good id={item.id} />}
                  </button>
                </li>
              );
            })}
          </ul>
          {misses >= 2 && !hint && (
            <button type="button" className="ghost" onClick={() => setHint(true)}>
              手助けを見る
            </button>
          )}
        </>
      )}

      {step === 'fold' && (
        <div className="wrap-step">
          <div className="bundle open" aria-hidden="true" />
          <button
            type="button"
            className="primary"
            onClick={() => {
              setStep('tie');
              setNote('布の角を合わせて、品を包みました。');
            }}
          >
            布を折る
          </button>
        </div>
      )}
      {step === 'tie' && (
        <div className="wrap-step">
          <div className="bundle folded" aria-hidden="true" />
          <button
            type="button"
            className="primary"
            onClick={() => {
              setStep('done');
              setNote('結び目を、きゅっと結びました。');
            }}
          >
            結ぶ
          </button>
        </div>
      )}
      {step === 'done' && (
        <div className="wrap-step">
          <div className="bundle tied" aria-hidden="true" />
          <button type="button" className="primary" onClick={onDone} autoFocus>
            お紺に渡す
          </button>
        </div>
      )}

      {step !== 'done' && (
        <button type="button" className="ghost" onClick={onCancel}>
          町に戻る（あとで包む）
        </button>
      )}
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
          <Good id={ghost.id} />
        </div>
      )}
    </div>
  );
}
