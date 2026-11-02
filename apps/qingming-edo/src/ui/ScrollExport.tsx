import { useEffect, useRef, useState } from 'react';
import type { SaveData } from '../contract';
import { posesFor } from '../scene/painted';
import { exportScroll, type ScrollMode, type ScrollPart } from '../scene/scrollExport';

// 長巻を画にする: the whole street as one picture for a phone, or the painting's own
// size in four pieces. Progress, cancel, retry; nothing about the player is in it.

const MODES: { id: ScrollMode; label: string; note: string }[] = [
  { id: 'phone', label: 'スマホ向け（一枚）', note: '高さ 700 ピクセルの横に長い一枚。送りやすい大きさです。' },
  { id: 'full', label: '原寸（四枚に分けて）', note: '絵の元の細かさのまま、右から順に四枚に分けます。' },
];

function save(part: ScrollPart) {
  const url = URL.createObjectURL(part.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = part.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ScrollExport({ save: data, onBack, onToast }: { save: SaveData; onBack(): void; onToast(t: string): void }) {
  const [mode, setMode] = useState<ScrollMode>('phone');
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'making'; done: number; total: number } | { kind: 'done'; parts: ScrollPart[] } | { kind: 'failed'; mode: ScrollMode }>({ kind: 'idle' });
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);

  const make = async (m: ScrollMode) => {
    const ctrl = new AbortController();
    stop.current = ctrl;
    setState({ kind: 'making', done: 0, total: 1 });
    try {
      const parts = await exportScroll(m, posesFor(data), (done, total) => setState({ kind: 'making', done, total }), ctrl.signal);
      setState({ kind: 'done', parts });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setState({ kind: 'idle' });
        onToast('作るのをやめました。');
      } else setState({ kind: 'failed', mode: m });
    } finally {
      if (stop.current === ctrl) stop.current = null;
    }
  };

  return (
    <div className="scroll-export">
      <h3>長巻を画にする</h3>
      <p className="small">日本橋から町はずれまで、通りを一続きの画にします。今のあなたの町の人の様子で描きます。進み具合や所持金は入りません。</p>

      {state.kind === 'idle' && (
        <>
          <fieldset>
            <legend>大きさ</legend>
            {MODES.map((m) => (
              <label key={m.id} className="check">
                <input type="radio" name="scroll-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
                <span>
                  {m.label}
                  <small>{m.note}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <button type="button" className="primary" onClick={() => make(mode)}>
            画を作る
          </button>
        </>
      )}

      {state.kind === 'making' && (
        <div role="status" aria-live="polite">
          <p>
            作っています……　{state.done} / {state.total} 区画
          </p>
          <progress max={state.total} value={state.done} />
          <button type="button" className="ghost" onClick={() => stop.current?.abort()}>
            やめる
          </button>
        </div>
      )}

      {state.kind === 'done' && (
        <div>
          <p>出来ました。{state.parts.length > 1 ? '右（日本橋）から順に保存してください。' : ''}</p>
          <ul className="scroll-parts">
            {state.parts.map((p, i) => (
              <li key={p.name}>
                <button type="button" onClick={() => save(p)}>
                  {state.parts.length > 1 ? `${i + 1}枚目を保存` : '画像を保存'}
                </button>
                <small>
                  {p.width} × {p.height}　{Math.round(p.blob.size / 1024)} KB
                </small>
              </li>
            ))}
          </ul>
          <button type="button" className="ghost" onClick={() => setState({ kind: 'idle' })}>
            作り直す
          </button>
        </div>
      )}

      {state.kind === 'failed' && (
        <div role="alert">
          <p>この端末では画を作れませんでした。{state.mode === 'phone' ? '「原寸（四枚に分けて）」なら一枚が小さくなり、作れることがあります。' : 'もう一度お試しください。'}</p>
          <button type="button" className="primary" onClick={() => make(state.mode)}>
            もう一度
          </button>
          {state.mode === 'phone' && (
            <button type="button" onClick={() => make('full')}>
              四枚に分けて作る
            </button>
          )}
        </div>
      )}

      <button type="button" className="ghost panel-foot" onClick={onBack}>
        絵巻帳に戻る
      </button>
    </div>
  );
}
