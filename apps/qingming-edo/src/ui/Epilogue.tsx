import { useState } from 'react';
import type { SaveData } from '../contract';
import { ABOUT } from '../content/about';
import { LOST } from '../content/lost';
import { NAJIMI, PROFILE } from '../content/people';
import { characterById, PAGE_SLOTS, ROLES } from '../content/world';
import { acquaintances } from '../engine/people';
import { hasFlag } from '../engine/state';
import { Face } from './Face';
import { PASSERS, favorFlag, passerFlag } from '../content/passers';

// 今日の町をふりかえる (after 橋のたもと): like the closing of an RPG, the people met pass by
// one at a time — portrait, なじみ, what 宗吉 says of them (町の人のこと), the stories shared and
// their day since (このごろの様子); then the passers-by talked with, on one page; then 宗吉's closing word. Only what happened; it changes nothing.

function sokichiOn(who: string): string | null {
  const a = ABOUT.sokichi?.[who];
  if (!a) return null;
  return typeof a === 'string' ? a : a.text;
}

export function Epilogue({ save, onJournal, onClose }: { save: SaveData; onJournal(): void; onClose(): void }) {
  const people = acquaintances(save).filter((p) => p.id !== 'sokichi');
  const [at, setAt] = useState(0);
  // passers-by talked with (content/passers.ts): one page of them all, before the closing
  const passers = Object.entries(PASSERS).filter(([id]) => hasFlag(save, passerFlag(id)));
  const passersAt = passers.length ? people.length + 1 : -1;
  const last = people.length + 1 + (passers.length ? 1 : 0); // 0: opening, 1..n: people, (n+1: passers-by), last: closing
  const helped = passers.filter(([id, p]) => p.favor && hasFlag(save, favorFlag(id)));
  const returned = LOST.filter((t) => hasFlag(save, `lost_back_${t.id}`)).length;
  const p = at >= 1 && at <= people.length ? people[at - 1] : null;

  return (
    <div className="panel epilogue" role="dialog" aria-labelledby="epi-h" aria-live="polite">
      <h2 id="epi-h">今日の町をふりかえる</h2>
      <p className="small epi-count">
        {at + 1} / {last + 1}
      </p>
      {at === 0 && (
        <div className="epi-card">
          <div className="line-body">
            <Face who="sokichi" />
            <p className="speaker">
              宗吉<small>{ROLES.sokichi}</small>
            </p>
            <p className="said">……今日、お前が出会った人たちだ。一人ずつ、思い出してみろ。</p>
          </div>
        </div>
      )}
      {p && (
        <div className="epi-card" key={p.id}>
          <div className="epi-face">
            <Face who={p.id} />
          </div>
          <p className="speaker epi-name">
            {characterById.get(p.id)?.displayName}
            <small>{ROLES[p.id]}</small>
          </p>
          <p className="najimi">
            <span className={`najimi-${p.level}`}>{NAJIMI[p.level]}</span>
          </p>
          {sokichiOn(p.id) ? <p className="said epi-word">宗吉「{sokichiOn(p.id)}」</p> : <p className="small">{PROFILE[p.id as keyof typeof PROFILE]}</p>}
          {p.shared.length > 0 && <p className="small">ともにしたこと：{p.shared.map((t) => `「${t}」`).join('')}</p>}
          {p.returned.length > 0 && <p className="small">返した落とし物：{p.returned.join('、')}</p>}
          {p.lately[0] && <p className="small epi-lately">{p.lately[p.lately.length - 1]}</p>}
        </div>
      )}
      {at === passersAt && (
        <div className="epi-card epi-passers">
          <div className="line-body">
            <Face who="sokichi" />
            <p className="speaker">
              宗吉<small>{ROLES.sokichi}</small>
            </p>
            <p className="said">{helped.length ? '名も知らない人たちとも、言葉を交わしたな。頼まれごとまで引き受けて。' : '名も知らない人たちとも、言葉を交わしたな。'}</p>
          </div>
          <ul>
            {passers.map(([id, p]) => (
              <li key={id}>
                <Face who={id} />
                <span>
                  <b>{p.name}</b>
                  <small>{p.favor && hasFlag(save, favorFlag(id)) ? `${characterById.get(p.favor.who)?.displayName}さんを教えた` : p.role}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {at === last && (
        <div className="epi-card">
          <div className="line-body">
            <Face who="sokichi" />
            <p className="speaker">
              宗吉<small>{ROLES.sokichi}</small>
            </p>
            <p className="said">町は、明日もこうして続いていく。描いた人たちも、描かなかった人たちもな。……また、歩きに来い。</p>
          </div>
          <p className="small epi-sum">
            出会った人 {people.length + 1}人　絵巻帳 {save.journal.pages.length} / {PAGE_SLOTS} 頁{returned > 0 ? `　返した落とし物 ${returned}つ` : ''}
            {passers.length > 0 ? `　通りで話した人 ${passers.length}人` : ''}
          </p>
        </div>
      )}
      <div className="epi-nav">
        <button type="button" onClick={() => setAt(at - 1)} disabled={at === 0}>
          前へ
        </button>
        {at < last ? (
          <button type="button" className="primary" onClick={() => setAt(at + 1)} autoFocus>
            次へ
          </button>
        ) : (
          <button type="button" className="primary" onClick={onJournal}>
            絵巻帳を開く
          </button>
        )}
      </div>
      <button type="button" className="ghost panel-foot" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
