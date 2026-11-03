import type { SaveData } from '../contract';
import { CHAPTERS } from '../content/world';
import { questState } from './state';

// 章 (iteration 2026-11-04 E1): with twelve stories, a new player is not handed ten invitations
// at once. Stories open chapter by chapter; a chapter opens once two stories of the one before
// are done (or all, if it has fewer). A story already begun or done is always open, so a save
// from before chapters keeps everything it had.

export function chapterOf(quest: string): number {
  return CHAPTERS.findIndex((c) => c.includes(quest));
}

function chapterDone(s: SaveData, k: number): boolean {
  const c = CHAPTERS[k];
  return c.filter((q) => questState(s, q) === 'complete').length >= Math.min(2, c.length);
}

/** How many chapters are open now (1 = only the first). */
export function openChapters(s: SaveData): number {
  let n = 1;
  while (n < CHAPTERS.length && chapterDone(s, n - 1)) n++;
  return n;
}

/** May this story be offered (its first step shown) now? */
export function questOpen(s: SaveData, quest: string): boolean {
  if (questState(s, quest) !== 'undiscovered') return true;
  const k = chapterOf(quest);
  return k < 0 || k < openChapters(s);
}
