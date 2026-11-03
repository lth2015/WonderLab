/** Fixed guides only. Pointer samples stay in the panel and never enter saves or records. */
export type Point = readonly [number, number];
export const TRACE_STROKES: { name: string; points: readonly Point[]; words: string }[] = [
  { name: '垂枝', points: [[92,43],[122,48],[148,64],[163,88],[167,114],[163,135]], words: '沈砚：先看枝往哪里垂，手跟着它慢慢走。' },
  { name: '新叶', points: [[146,73],[127,87],[121,105],[137,95],[146,73]], words: '沈砚：叶尖往下，叶腹留一点空，春风就有地方经过。' },
  { name: '水纹', points: [[75,158],[108,150],[141,154],[176,148],[209,152],[244,146]], words: '沈砚：柳还在岸上，水已把它接过去了。留一笔水纹吧。' },
];
export const tracePath = (points: readonly Point[]) => points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ');
export function nextTracePoint(points: readonly Point[], next: number, point: Point): number {
  const target = points[next];
  return target && Math.hypot(point[0]-target[0],point[1]-target[1]) <= 19 ? next+1 : next;
}
/** An eight second breeze: the paper settles for three seconds between gusts. */
export function windIsLight(elapsed: number): boolean {
  if (!Number.isFinite(elapsed) || elapsed < 0) return false;
  const phase=elapsed % 8000;
  return phase >= 2500 && phase < 5500;
}
