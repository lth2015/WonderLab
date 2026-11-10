import { ai } from './ai';
import { ame } from './ame';
import { fumi } from './fumi';
import { hashi } from './hashi';
import { inkyo } from './inkyo';
import { kashi } from './kashi';
import { neko } from './neko';
import type { StoryModule } from './types';
import { ugoki } from './ugoki';
import { yube } from './yube';

/**
 * The stories that live in their own files, in the order of their pages (四頁目 onwards).
 * A new story: one file here, one line in this list, its chapter in content/world.ts CHAPTERS.
 */
export const STORIES: StoryModule[] = [kashi, fumi, yube, ai, hashi, neko, inkyo, ugoki, ame];
