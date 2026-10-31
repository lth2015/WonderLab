import { useState } from 'react';
import { TEA_GUESTS, TEA_SETS, type TeaSetId } from '../content/world';

// 茶店の気配り (spec §10): read two regulars' likings and serve each one of three
// tea-and-sweet sets. Likings are shown in words and as marks. Choices can be
// changed before serving; a mismatch gets a kind word and another try. No timer;
// what counts is having listened, not speed. No health claims for any tea.

type Temp = 'hot' | 'warm' | 'cold';

export function TempMark({ temp, size = 22 }: { temp: Temp; size?: number }) {
  const c = temp === 'hot' ? '#a25540' : temp === 'warm' ? '#b78a3c' : '#3d5677';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M 5 11 h 14 v 4 a 5 5 0 0 1 -5 5 h -4 a 5 5 0 0 1 -5 -5 Z" fill="none" stroke={c} strokeWidth={1.8} />
      {temp === 'hot' && <path d="M 9 8 q -2 -3 0 -6 M 13 8 q -2 -3 0 -6 M 17 8 q -2 -3 0 -6" fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" />}
      {temp === 'warm' && <path d="M 11 8 q -2 -3 0 -5" fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" />}
      {temp === 'cold' && <path d="M 12 2 v 6 M 9 3.5 l 6 3 M 15 3.5 l -6 3" stroke={c} strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  );
}

export function SweetMark({ sweet, size = 22 }: { sweet: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M 3 21 L 21 3" stroke="#6e5238" strokeWidth={1.4} />
      <circle cx={8} cy={16} r={3.2} fill={sweet ? '#e3b8b0' : '#d8cdb8'} stroke="#514d3e" strokeWidth={1} />
      <circle cx={12} cy={12} r={3.2} fill={sweet ? '#f2ede0' : '#d8cdb8'} stroke="#514d3e" strokeWidth={1} />
      <circle cx={16} cy={8} r={3.2} fill={sweet ? '#a9c08f' : '#d8cdb8'} stroke="#514d3e" strokeWidth={1} />
      {!sweet && <path d="M 4 4 L 20 20" stroke="#a25540" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  );
}

const TEMP_WORD: Record<Temp, string> = { hot: '熱いのがいい', warm: 'ぬるめがいい', cold: '冷たいのがいい' };

const MISMATCH: Record<string, string> = {
  daiku: '「おっと、こいつはちょいと違うな。冷てえのと、甘いもんがいいんだが。」',
  shisho: '「あら、ありがとう。でもね、熱いのと甘いのは、今日は遠慮しておくわ。」',
};

export function Tea({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const [chosen, setChosen] = useState<Record<string, TeaSetId | undefined>>({});
  const [served, setServed] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('二人の好みを聞いて、それぞれに茶と菓子を選んでください。出す前なら選び直せます。');
  const allServed = TEA_GUESTS.every((g) => served[g.id]);

  const serve = () => {
    const next = { ...served };
    const missed: string[] = [];
    for (const g of TEA_GUESTS) {
      if (chosen[g.id] === g.wants) next[g.id] = true;
      else missed.push(g.id);
    }
    setServed(next);
    if (missed.length === 0) setNote('二人とも、うれしそうに手を伸ばした。');
    else setNote(missed.map((id) => MISMATCH[id]).join(' ') + ' 選び直してみましょう。');
  };

  return (
    <div className="panel tea" role="dialog" aria-labelledby="tea-h">
      <h2 id="tea-h">茶店の気配り</h2>
      <p className="wrap-note" aria-live="polite">
        {note}
      </p>
      {TEA_GUESTS.map((g) => (
        <section key={g.id} className={`guest${served[g.id] ? ' happy' : ''}`} aria-label={g.label}>
          <h3>{g.label}</h3>
          <p className="says">「{g.says}」</p>
          <p className="likes">
            <span className="like">
              <TempMark temp={g.likes.temp} />
              {TEMP_WORD[g.likes.temp]}
            </span>
            <span className="like">
              <SweetMark sweet={g.likes.sweet} />
              {g.likes.sweet ? '甘いものが好き' : '甘さは控えめに'}
            </span>
          </p>
          <div className="sets">
            {TEA_SETS.map((t) => (
              <button
                type="button"
                key={t.id}
                className="set"
                aria-pressed={chosen[g.id] === t.id}
                disabled={!!served[g.id]}
                onClick={() => setChosen((c) => ({ ...c, [g.id]: t.id }))}
              >
                <span className="set-marks">
                  <TempMark temp={t.temp} size={18} />
                  <SweetMark sweet={t.sweet} size={18} />
                </span>
                {t.label}
              </button>
            ))}
          </div>
          {served[g.id] && <p className="small">出しました。</p>}
        </section>
      ))}
      {allServed ? (
        <button type="button" className="primary" onClick={onDone} autoFocus>
          二人の話を聞く
        </button>
      ) : (
        <button type="button" className="primary" onClick={serve} disabled={TEA_GUESTS.some((g) => !served[g.id] && !chosen[g.id])}>
          お茶を出す
        </button>
      )}
      {!allServed && (
        <button type="button" className="ghost" onClick={onCancel}>
          町に戻る（あとで運ぶ）
        </button>
      )}
    </div>
  );
}
