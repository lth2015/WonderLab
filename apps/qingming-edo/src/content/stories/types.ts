import type { CharacterDef, Condition, HotspotDef, PageDef, QuestDef, QuestState, SaveData } from '../../contract';
import type { DialogueNode, Line } from '../types';

// 物語の部品 (iteration 2026-11-04 E2): everything one story adds, in one file under
// content/stories/. The registry (./index.ts) lists them; content/world.ts, content/script.ts,
// content/pageText.ts, engine/story.ts and scene/painted.tsx assemble them. A new story is one
// new file and one line in the registry. Drawing that no other story uses (a leaping cat, lit
// lamps) still lives in scene/painted.tsx.

/** One opening rule for a person or thing; `rank` places it among the rules of other stories. */
export interface Rule {
  rank: number;
  when?: Condition;
  node: string;
}

/** A 「近くのこと」 line (engine/story.ts). */
export interface Nearby {
  id: string;
  text: string;
  spotId: string;
  /** Waits for another time of day (朝・昼・夕) or the rain: listed after what can be done now. */
  later?: boolean;
}

/** What a story's 「近くのこと」 may look at (passed in, so stories import no engine code). */
export interface NearbyCtx {
  questState(quest: string): QuestState;
  hasFlag(flag: string): boolean;
  time: 'morning' | 'noon' | 'evening';
  rain: boolean;
  rainOpen: boolean;
  /** The scene x at the middle of the view, if known. */
  here?: number;
  /** A hotspot's anchor x. */
  xOf(spotId: string): number;
  save: SaveData;
}

/** A journal page's picture: a rectangle of the painted street and the people on it. */
export interface View {
  x0: number;
  y0: number;
  w: number;
  people: { id: string; x: number; y: number; flip?: boolean }[];
  /** Drawn in this time whatever the time now (夕暮れの灯 is an evening page). */
  tod?: 'morning' | 'evening';
  /** The street lamps lit over the picture. */
  lamps?: boolean;
  /** Rain over the picture. */
  rain?: boolean;
}

export interface StoryModule {
  quest: QuestDef;
  /** People this story brings to the street, with their role line. */
  characters?: CharacterDef[];
  roles?: Record<string, string>;
  hotspots?: HotspotDef[];
  pages: PageDef[];
  titles: Record<string, string>;
  nodes: Record<string, DialogueNode>;
  /** Where 回想 starts; also the node that begins the story (chapters wait on it). */
  recallStart: string;
  /** Opening rules by person or thing, merged with everyone else's by rank. */
  entries: Record<string, Rule[]>;
  /** Morning and evening versions of everyday words (content/script.ts AT_TIME). */
  atTime?: Record<string, Partial<Record<'morning' | 'evening', Line>>>;
  /** Nodes after which the person can talk a little (即興のひとこと). */
  talk?: string[];
  /** Place line and 宗吉's word by composition; the 回想 note. */
  place: Record<string, string>;
  comment: Record<string, string>;
  recallNote: string;
  /** Is this a page this story can leave? (null: not this story's page) */
  valid(pageId: string, compositionId: string): boolean | null;
  /** The page picture for a composition of this story (null: not this story's). */
  view(composition: string): View | null;
  /** 「近くのこと」 lines, and where among the stories they are pushed. */
  nearbyRank: number;
  nearby(ctx: NearbyCtx): Nearby[];
}
