import type { SaveData } from '../contract';
import { LOST } from '../content/lost';
import { HOTSPOTS } from '../content/world';
import { hasFlag } from './state';
import { nearbyAll } from './story';

// 町の絵図 (owner's demo feedback 2026-11-04: 「地图」): the whole roll folded into four rows,
// the bridge end on top. What it marks is worked out here, so it can be tested without drawing.

/** Scene units per map row, and the rows from the top: the bridge end first. */
export const MAP_ROW_UNITS = 4000;
export const MAP_ROWS = [12000, 8000, 4000, 0];
export const MAP_PX_PER_UNIT = 0.2;
export const MAP_ROW_H = 140; // 700 units

export interface MapMark {
  kind: 'ask' | 'lost';
  x: number;
  y: number;
  label: string;
}

/** Where someone has a request waiting (or a story under way), and where a lost thing is said to be. */
export function mapMarks(s: SaveData): MapMark[] {
  const marks: MapMark[] = [];
  const seen = new Set<string>();
  for (const n of nearbyAll(s)) {
    if (n.id === 'sketches' || seen.has(n.spotId)) continue;
    const h = HOTSPOTS.find((x) => x.id === n.spotId);
    // a person not yet greeted is not a request: only what someone is waiting for
    if (!h || /^(okon|kisuke|oharu|kinji)$/.test(n.id)) continue;
    seen.add(n.spotId);
    marks.push({ kind: 'ask', x: h.anchor.x, y: h.anchor.y, label: n.text });
  }
  for (const t of LOST) {
    if (!hasFlag(s, `lost_hint_${t.id}`) || hasFlag(s, `lost_found_${t.id}`)) continue;
    // the area, not the spot: drawn a little off the thing itself
    marks.push({ kind: 'lost', x: t.at.x + (t.id.length % 2 ? 90 : -90), y: t.at.y - 40, label: `落とし物のうわさ：${t.place}のあたり` });
  }
  return marks;
}

/** Map row and x/y in the map image (px) for a scene point. */
export function toMap(x: number, y: number): { row: number; px: number; py: number } {
  const row = Math.min(3, Math.max(0, MAP_ROWS.findIndex((r) => x >= r)));
  return { row, px: (x - MAP_ROWS[row]) * MAP_PX_PER_UNIT, py: y * MAP_PX_PER_UNIT };
}
