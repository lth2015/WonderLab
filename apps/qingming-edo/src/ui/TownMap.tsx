import mapUrl from '../assets/map/edo-map.webp';
import type { SaveData } from '../contract';
import { MAP_PX_PER_UNIT, MAP_ROW_H, MAP_ROW_UNITS, MAP_ROWS, mapMarks, toMap } from '../engine/townMap';

// 町の絵図: the roll folded into four rows. A tap on a row takes the street there.
// Marks: the part of the street in view now, 依 where someone waits for the player,
// ？ around where a lost thing is said to be.

const ROW_NAMES = ['橋のたもと・向こう岸', '茶店・小路の井戸', '米屋・堀の河岸・桶屋', '紺屋・水辺の庭・町はずれ'];
const W = MAP_ROW_UNITS * MAP_PX_PER_UNIT; // 800 px

export function TownMap({ save, view, onGo, onClose }: { save: SaveData; view: { x0: number; w: number } | null; onGo(x: number): void; onClose(): void }) {
  const marks = mapMarks(save);
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
              aria-label={`${ROW_NAMES[r]}${rowMarks.length ? `（${rowMarks.map((m) => m.label).join('、')}）` : ''}。押すとそこへ行きます`}
              onClick={(e) => {
                const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                onGo(start + ((e.clientX - b.left) / b.width) * MAP_ROW_UNITS);
              }}
            >
              <image href={mapUrl} x={0} y={0} width={W} height={MAP_ROW_H * 4} />
              <text x={8} y={r * MAP_ROW_H + 20} className="map-row-name">
                {ROW_NAMES[r]}
              </text>
              {view && vx1 > vx0 && (
                <rect className="map-here" x={(vx0 - start) * MAP_PX_PER_UNIT} y={r * MAP_ROW_H + 3} width={(vx1 - vx0) * MAP_PX_PER_UNIT} height={MAP_ROW_H - 6} rx={4} />
              )}
              {rowMarks.map((m, i) => {
                const p = toMap(m.x, m.y);
                const cy = r * MAP_ROW_H + Math.min(MAP_ROW_H - 18, Math.max(18, p.py));
                return m.kind === 'ask' ? (
                  <g key={i} className="map-ask">
                    <title>{m.label}</title>
                    <circle cx={p.px} cy={cy} r={18} />
                    <text x={p.px} y={cy + 8}>依</text>
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
        <span className="map-key here" /> いま見ているところ　<span className="map-key ask">依</span> 頼みごと　<span className="map-key lost">？</span> 落とし物のうわさ
      </p>
      <button type="button" className="primary panel-foot" onClick={onClose}>
        町に戻る
      </button>
    </div>
  );
}
