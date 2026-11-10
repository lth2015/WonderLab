import type { SaveData } from '../contract';
import { NAJIMI, PROFILE } from '../content/people';
import { characterById, ROLES } from '../content/world';
import { acquaintances } from '../engine/people';
import { Face } from './Face';
import { PASSERS, favorFlag, passerFlag } from '../content/passers';
import { hasFlag } from '../engine/state';

// 人物帳: the people met, with their portrait, how well they know the player, and the
// stories shared. 会いに行く moves the street to where they are now.

export function People({ save, onVisit }: { save: SaveData; onVisit(spotId: string): void }) {
  const people = acquaintances(save);
  // passers-by the player stopped to talk with (content/passers.ts)
  const passers = Object.entries(PASSERS).filter(([id]) => hasFlag(save, passerFlag(id)));
  return (
    <>
    <ul className="people">
      {people.map((p) => (
        <li key={p.id} className="person">
          <div className="line-body">
            <Face who={p.id} />
            <p className="speaker">
              {characterById.get(p.id)?.displayName}
              <small>{ROLES[p.id]}</small>
            </p>
            <p className="najimi">
              <span className={`najimi-${p.level}`}>{NAJIMI[p.level]}</span>
            </p>
            <p className="small">{PROFILE[p.id as keyof typeof PROFILE]}</p>
            {p.shared.length > 0 && <p className="small shared">ともにしたこと：{p.shared.map((t) => `「${t}」`).join('')}</p>}
            {p.returned.length > 0 && <p className="small">返した落とし物：{p.returned.join('、')}</p>}
            {p.lately.length > 0 && (
              <div className="lately">
                <p className="small lately-h">このごろの様子</p>
                {p.lately.map((t) => (
                  <p key={t} className="small lately-t">
                    {t}
                  </p>
                ))}
              </div>
            )}
          </div>
          {p.spotId ? (
            <button type="button" onClick={() => onVisit(p.spotId!)}>
              会いに行く
            </button>
          ) : (
            <p className="small away">いまは通りに見当たらない（時刻や天気が変わると、会えるかもしれない）</p>
          )}
        </li>
      ))}
    </ul>
    {passers.length > 0 && (
      <section className="passers-met" aria-labelledby="passers-h">
        <h3 id="passers-h">通りで言葉を交わした人</h3>
        <ul>
          {passers.map(([id, p]) => (
            <li key={id}>
              <Face who={id} />
              <span>
                <b>{p.name}</b>
                <small>{p.role}</small>
                {p.favor && hasFlag(save, favorFlag(id)) && <small className="favor-done">頼まれて、{characterById.get(p.favor.who)?.displayName}さんを教えた</small>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )}
    </>
  );
}
