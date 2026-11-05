import type { Effect } from '../contract';
import type { Subject } from './world';

// The shape of the script (台本): people's lines, choices and the nodes they make up.

export type Speaker = string; // a character id, or 'narration'

/** `reward`: a line about being paid, left out in 回想 (replays never pay). */
export interface Line { by: Speaker; text: string; reward?: boolean }
export interface Choice {
  label: string;
  next?: string;
  effects?: Effect[];
  /** Opens the sketch for this subject (spec §9 一頁目). */
  sketch?: Subject;
  /** Stays to talk a little (即興のひとこと, ui/Talk.tsx). */
  talk?: boolean;
  /** Opens a shop (ui/Shop.tsx): 喜助's tea, 青葉屋's title slips. */
  shop?: 'tea' | 'slips';
  /** Opens a short game; on success the dialogue goes on at `next` (spec §10). */
  game?: 'wrap' | 'tea' | 'tenugui' | 'trace';
  /** なぞり描き: which sketch place is traced (with game 'trace'). */
  trace?: string;
}
export interface DialogueNode {
  lines: Line[];
  /** Applied once when the node opens. */
  effects?: Effect[];
  choices?: Choice[];
  next?: string;
  /** A journal page this node leaves (made once; spec §9). */
  page?: { pageId: string; compositionId: string };
  /** In 回想, where the scene goes on when the original sends the player walking elsewhere. */
  recallNext?: string;
  /** A passing moment: its effects apply and its one line shows as a note over the street, no dialogue (茶店の猫). */
  brief?: boolean;
  /** 物語の画: a painting (assets/cg/<id>.webp) in place of the street while this node is read (ui/Cg.tsx). */
  cg?: string;
}
