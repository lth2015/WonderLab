import mapUrl from '../assets/map/edo-map.webp';
import type { SaveData } from '../contract';
import { MAP_PX_PER_UNIT, MAP_ROW_H, MAP_ROW_UNITS, MAP_ROWS, mapMarks, passerMarks, personMarks, toMap } from '../engine/townMap';
import { faceUrl } from './Face';

// 町の絵図: the roll folded into four rows. A tap on a row takes the street there.
// Marks: the part of the street in view now, 依 where someone waits for the player,
// ？ around where a lost thing is said to be.

const ROW_NAMES = ['橋のたもと・向こう岸', '茶店・小路の井戸', '米屋・堀の河岸・桶屋', '紺屋・水辺の庭・町はずれ'];
const W = MAP_ROW_UNITS * MAP_PX_PER_UNIT; // 800 px

export function TownMap({ save, view, onGo, onClose }: { save: SaveData; view: { x0: number; w: number } | null; onGo(x: number): void; onClose(): void }) {
  const marks = mapMarks(save);
  // the people met, where they are now: drawn under the marks; a 依 at a person's spot sits on their shoulder
  const people = personMarks(save);
  const atPerson = (x: number, y: number) => people.some((p) => p.x === x && p.y === y);
  // the passers-by out now, on the stretch of road they walk (drawn under the people met)
  const passers = passerMarks(save);
  return (
    <div className="panel town-map" role="dialog" aria-labelledby="map-h">
      <h2 id="map-h">町の絵図</h2>
      <p className="small">行きたいところを押すと、通りがそこへ動きます。上が橋のたもと、下が町はずれ。</p>
      <div className="map-rows">
        {MAP_ROWS.map((start, r) => {
          const vx0 = view ? Math.max(view.x0, start) : 0;
          const vx1 = view ? Math.min(view.x0 + view.w, start + MAP_ROW_UNITS) : 0;
          const rowMarks = marks.filter((m) => toMap(m.x, m.y).row === r);
          return (
            <svg
              key={r}
              className="map-row"
              viewBox={`0 ${r * MAP_ROW_H} ${W} ${MAP_ROW_H}`}
              role="button"
              tabIndex={0}
              aria-label={`${ROW_NAMES[r]}${rowMarks.length ? `（${rowMarks.map((m) => m.label).join('、')}）` : ''}。押すとそこへ行きます`}
              onClick={(e) => {
                const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                onGo(start + ((e.clientX - b.left) / b.width) * MAP_ROW_UNITS);
              }}
              // keyboard: Enter or Space goes to the middle of the row (marks have their own list below)
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onGo(start + MAP_ROW_UNITS / 2);
              }}
            >
              <image href={mapUrl} x={0} y={0} width={W} height={MAP_ROW_H * 4} />
              <text x={8} y={r * MAP_ROW_H + 20} className="map-row-name">
                {ROW_NAMES[r]}
              </text>
              {view && vx1 > vx0 && (
                <rect className="map-here" x={(vx0 - start) * MAP_PX_PER_UNIT} y={r * MAP_ROW_H + 3} width={(vx1 - vx0) * MAP_PX_PER_UNIT} height={MAP_ROW_H - 6} rx={4} />
              )}
              {passers
                .filter((m) => toMap(m.x, m.y).row === r)
                .map((m) => {
                  const p = toMap(m.x, m.y);
                  const cy = r * MAP_ROW_H + Math.min(MAP_ROW_H - 18, Math.max(18, p.py - 10));
                  const href = faceUrl(m.who!);
                  return (
                    <g key={m.who} className={`map-passer${m.talked ? ' talked' : ''}`}>
                      <title>{m.label}</title>
                      <line x1={(m.span![0] - start) * MAP_PX_PER_UNIT} x2={(m.span![1] - start) * MAP_PX_PER_UNIT} y1={cy + 12} y2={cy + 12} />
                      <clipPath id={`mq-${m.who}`}>
                        <circle cx={p.px} cy={cy} r={13} />
                      </clipPath>
                      <circle className="map-passer-bg" cx={p.px} cy={cy} r={15} />
                      {href && <image href={href} x={p.px - 16} y={cy - 15} width={32} height={32} clipPath={`url(#mq-${m.who})`} />}
                    </g>
                  );
                })}
              {people
                .filter((m) => toMap(m.x, m.y).row === r)
                .map((m) => {
                  const p = toMap(m.x, m.y);
                  const cy = r * MAP_ROW_H + Math.min(MAP_ROW_H - 26, Math.max(26, p.py - 20));
                  const href = faceUrl(m.who!);
                  return (
                    <g key={m.who} className="map-person">
                      <title>{m.label}</title>
                      <clipPath id={`mp-${m.who}`}>
                        <circle cx={p.px} cy={cy} r={22} />
                      </clipPath>
                      <circle className="map-person-bg" cx={p.px} cy={cy} r={24} />
                      {href && <image href={href} x={p.px - 26} y={cy - 24} width={52} height={52} clipPath={`url(#mp-${m.who})`} />}
                    </g>
                  );
                })}
              {rowMarks.map((m, i) => {
                const p0 = toMap(m.x, m.y);
                const onPerson = m.kind === 'ask' && atPerson(m.x, m.y);
                const p = onPerson ? { ...p0, px: p0.px + 20, py: p0.py - 44 } : p0;
                const cy = r * MAP_ROW_H + Math.min(MAP_ROW_H - 18, Math.max(18, p.py));
                return m.kind === 'ask' ? (
                  <g key={i} className={`map-ask${onPerson ? ' on-person' : ''}`}>
                    <title>{m.label}</title>
                    <circle cx={p.px} cy={cy} r={onPerson ? 14 : 18} />
                    <text x={p.px} y={cy + (onPerson ? 6 : 8)}>依</text>
                  </g>
                ) : (
                  <g key={i} className="map-lost">
                    <title>{m.label}</title>
                    <circle cx={p.px} cy={cy} r={34} />
                    <text x={p.px} y={cy + 7}>？</text>
                  </g>
                );
              })}
            </svg>
          );
        })}
      </div>
      <p className="map-legend small">
        <span className="map-key here" /> いま見ているところ　<span className="map-key person" /> 出会った人　<span className="map-key passer" /> 通りの人（いま出ている）　<span className="map-key ask">依</span> 頼みごと　<span className="map-key lost">？</span> 落とし物のうわさ
      </p>
      {marks.length + people.length + passers.length > 0 && (
        // the marks as words too: for the keyboard and for reading aloud
        <details className="fold map-list">
          <summary>印と人のいるところ（文字で選ぶ）</summary>
          <ul className="list compact">
            {[...marks, ...people, ...passers]
              .sort((a, b) => b.x - a.x)
              .map((m, i) => (
                <li key={i}>
                  <button type="button" onClick={() => onGo(m.x)}>
                    {m.kind === 'ask' ? '依　' : m.kind === 'lost' ? '？　' : m.kind === 'passer' ? '通　' : '人　'}
                    {m.label}
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
      <button type="button" className="primary panel-foot" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
