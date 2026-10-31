import { useState } from 'react';
import { TENUGUI } from '../content/world';

// あの人の手拭い (spec §9 三頁目): look at the pattern and the knot of two
// forgotten cloths and choose the ご隠居's. A wrong choice costs nothing: it
// brings one more clue, and the choice stays open.

function Cloth({ pattern, knot }: { pattern: 'wave' | 'hemp'; knot: 'tight' | 'loose' }) {
  const id = `pat-${pattern}`;
  return (
    <svg viewBox="0 0 160 120" width="100%" aria-hidden="true">
      <defs>
        <pattern id={id} width={pattern === 'wave' ? 24 : 20} height={pattern === 'wave' ? 12 : 20} patternUnits="userSpaceOnUse">
          {pattern === 'wave' ? (
            <path d="M 0 12 a 12 12 0 0 1 24 0 M 4 12 a 8 8 0 0 1 16 0 M 8 12 a 4 4 0 0 1 8 0" fill="none" stroke="#e9e2cf" strokeWidth={1.2} />
          ) : (
            <path d="M 10 0 L 10 20 M 0 10 L 20 10 M 0 0 L 20 20 M 20 0 L 0 20" stroke="#e9e2cf" strokeWidth={0.9} />
          )}
        </pattern>
      </defs>
      {/* the cloth, folded long, hanging from its knot */}
      <path d="M 40 30 L 120 30 L 116 112 L 44 112 Z" fill="#3d5677" stroke="#2c3a52" strokeWidth={1.5} />
      <path d="M 40 30 L 120 30 L 116 112 L 44 112 Z" fill={`url(#${id})`} opacity={0.85} />
      {knot === 'tight' ? (
        <g>
          <ellipse cx={80} cy={26} rx={13} ry={10} fill="#34496a" stroke="#22304a" strokeWidth={1.5} />
          <path d="M 70 22 q 10 10 20 0" fill="none" stroke="#22304a" strokeWidth={1.4} />
        </g>
      ) : (
        <g>
          <path d="M 80 26 q -26 -22 -32 -2 q 6 12 32 2 q 26 10 32 -2 q -6 -20 -32 2 Z" fill="#46597a" stroke="#22304a" strokeWidth={1.4} />
          <circle cx={80} cy={26} r={5} fill="#34496a" stroke="#22304a" strokeWidth={1.2} />
        </g>
      )}
    </svg>
  );
}

export function Tenugui({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const [tries, setTries] = useState(0);
  const [note, setNote] = useState('女師匠の話を思い出して、二本の手拭いを見比べてください。');
  const [wrong, setWrong] = useState<string | null>(null);

  const pick = (id: string) => {
    const t = TENUGUI.find((x) => x.id === id)!;
    if (t.owner) return onDone();
    setWrong(id);
    setTries((n) => n + 1);
    setNote(
      tries === 0
        ? 'お春がそっと言った。「ご隠居さま、結び目はいつも固く結ぶ方なんです。」もう一度見てみましょう。'
        : '喜助が言った。「波の柄だったって、女師匠さんが言ってたろう。」',
    );
  };

  return (
    <div className="panel tenugui" role="dialog" aria-labelledby="tenugui-h">
      <h2 id="tenugui-h">二本の手拭い</h2>
      <p className="wrap-note" aria-live="polite">
        {note}
      </p>
      <ul className="cloths-2">
        {TENUGUI.map((t) => (
          <li key={t.id}>
            <figure className={wrong === t.id ? 'dim' : ''}>
              <Cloth pattern={t.pattern} knot={t.knot} />
              <figcaption>
                {t.label}
                <br />
                結び目：{t.knotLabel}
              </figcaption>
            </figure>
            <button type="button" onClick={() => pick(t.id)}>
              これがご隠居さんの
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ghost" onClick={onCancel}>
        町に戻る（あとで見る）
      </button>
    </div>
  );
}
