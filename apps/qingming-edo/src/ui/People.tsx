import type { SaveData } from '../contract';
import { NAJIMI, PROFILE } from '../content/people';
import { characterById, ROLES } from '../content/world';
import { acquaintances } from '../engine/people';
import { Face } from './Face';

// 人物帳: the people met, with their portrait, how well they know the player, and the
// stories shared. 会いに行く moves the street to where they are now.

export function People({ save, onVisit }: { save: SaveData; onVisit(spotId: string): void }) {
  const people = acquaintances(save);
  return (
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
  );
}
