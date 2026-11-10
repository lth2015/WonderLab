// ---------------------------------------------------------------- passers-by

/**
 * Passers-by along the whole scroll (style decision #7), drawn by scene/painted.tsx and
 * spoken to or sketched by the stories. A fixed pattern: the street looks the same on every visit.
 */
// Each silhouette appears once in the entire roll. Curated road positions
// replace the old eight-sprite cycle (~40 copies at 300-unit intervals).
export const CROWD: { id: string; x: number; y: number; flip: boolean }[] = [
  { id: 'crowd2-samurai', x: 880, y: 612, flip: false },
  { id: 'crowd2-elder', x: 2300, y: 610, flip: true },
  { id: 'crowd1-monk', x: 3750, y: 608, flip: false },
  { id: 'crowd2-fishmonger', x: 5650, y: 610, flip: true },
  { id: 'crowd1-merchant', x: 8040, y: 610, flip: false },
  { id: 'crowd2-apprentice', x: 9550, y: 614, flip: true },
  { id: 'crowd1-parasol', x: 10780, y: 610, flip: false },
  { id: 'crowd1-porter', x: 12300, y: 624, flip: true },
  // three more who stop and talk of their trade (owner 2026-11-10); appended, so the others keep their pattern
  { id: 'crowd3-hikyaku', x: 1700, y: 612, flip: false },
  { id: 'crowd3-daiku', x: 6900, y: 610, flip: true },
  { id: 'crowd3-ameuri', x: 11100, y: 612, flip: false },
];

/**
 * 町が動く (owner's demo feedback: 「人不能动」): each passer-by strolls back and forth
 * along their own stretch of road, first the way they face (the art faces left unless
 * flipped), turning at each end. Slow on purpose: about 22 units a second.
 */
export function walkOf(c: { x: number; flip: boolean }, i: number): { dx: number; dur: number; delay: number } {
  const length = 300 + ((i * 47) % 130); // 300–430 units
  const dx = c.flip ? length : -length;
  const dur = (2 * length) / 22; // there and back
  return { dx, dur, delay: -((i * 7.3) % dur) };
}

/** 朝 quieter, 昼 everyone, 夕 going home: who is out (the clerk of 母への文 always is). */
export function outAt(tod: 'morning' | 'noon' | 'evening', id: string, i: number): boolean {
  if (id === 'crowd1-merchant' || tod === 'noon') return true;
  return tod === 'morning' ? i % 3 !== 1 : i % 2 === 0;
}
