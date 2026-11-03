import type { ENVIRONMENT } from './content';

export type EnvironmentId = typeof ENVIRONMENT[number]['id'];
export type ReactionKind = 'leaves' | 'ripples' | 'breeze' | 'stretch' | 'birds' | 'dust' | 'steam' | 'chime' | 'shavings';
export type SceneReaction = { id: EnvironmentId; serial: number };
export const REACTION_MS = 1400;
/** Exhaustive: adding a hotspot requires choosing its visible response. */
export const REACTIONS = {
  willow:'leaves', water:'ripples', banner:'breeze', cat:'stretch', sparrow:'birds', wheel:'dust', brazier:'steam', bell:'chime',
  well:'ripples', silk:'breeze', camels:'dust', oxcart:'dust', dye:'breeze', restaurant:'steam', washing:'ripples',
  grain:'dust', boatyard:'shavings', inn:'steam', mill:'ripples', farmers:'leaves', ferry:'ripples',
} as const satisfies Record<EnvironmentId, ReactionKind>;
