// 共通データ契約 第一版（schemaVersion 1）の江戸側草稿 — spec §15.
//
// Spec §14: Codex proposes the shared contract and the Edo side confirms it.
// Until that is fixed in packages/scroll-contracts/, this file is the Edo
// app's own reading of the §15 table, so neither app waits for the other.
// When the shared version lands, only an adapter here should need to change.
//
// Internal ids are stable ASCII; every displayed string lives in content/.
// Nothing here names a place, a language, a real price or a payment company.

export const SCHEMA_VERSION = 1 as const;
export const WORLD_ID = 'qingming-edo' as const;

/** Spec §15 根拠: observed / historical / fiction / balance. Never show 'unreviewed' as 考証済み. */
export type EvidenceType = 'observed' | 'historical' | 'fiction' | 'balance';
export type ReviewStatus = 'unreviewed' | 'reviewed';
export interface Evidence {
  evidenceType: EvidenceType;
  sourceRefs: string[];
  reviewStatus: ReviewStatus;
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

/**
 * Conditions are data, evaluated by a fixed set of operators (engine/conditions.ts).
 * No free text is ever run as code (spec §15 人物・選択対象).
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string }
  | { quest: string; is: QuestState | QuestState[] };

/** Spec §9: 未発見、発見済み、進行中、提出待ち、完了、回想可能. */
export type QuestState = 'undiscovered' | 'discovered' | 'active' | 'ready' | 'complete';
// 回想可能 is derived: complete && replayPolicy !== 'none' (engine/state.ts).

export type Effect =
  | { type: 'setFlag'; flag: string }
  | { type: 'questState'; quest: string; state: QuestState }
  | { type: 'grant'; rewardId: string; amountMinor: number }
  | { type: 'familiarity'; characterId: string; eventId: string };

export interface LayerDef {
  id: string;
  /** Parallax factor against the camera: 1 moves with the street. */
  depth: number;
}

export interface HotspotDef {
  id: string;
  /** What it opens: a character id, or an ambient reaction id. */
  targetId: string;
  kind: 'character' | 'prop' | 'ambient';
  anchor: Point;
  /** Scene units. The engine widens it to 44×44 CSS px at the current scale (spec §7). */
  hitArea: Rect;
  /** Higher wins when areas overlap; ties offer at most three candidates. */
  priority: number;
  visibleWhen?: Condition;
}

export interface SceneDef {
  id: string;
  bounds: Rect;
  layers: LayerDef[];
  hotspots: HotspotDef[];
  ambienceId: string;
  /** 画面区間: composition and loading units (spec §5); x ranges in scene units. */
  sections: { id: string; x0: number; x1: number }[];
}

export interface CharacterDef extends Evidence {
  id: string;
  sceneId: string;
  displayName: string;
  scriptId: string;
  knowledgeIds: string[];
  /** Children get scripted lines only, never generated ones (spec §8, §12). */
  isChild: boolean;
}

export interface StepDef { id: string; doneWhen: Condition }

export interface QuestDef {
  id: string;
  prerequisites: Condition[];
  steps: StepDef[];
  completionEffects: Effect[];
  /** Replays never pay again (spec §11). */
  replayPolicy: 'none' | 'memory-only';
}

export interface ItemDef extends Evidence {
  id: string;
  displayName: string;
  currencyId: 'mon';
  /** Non-negative integer. 'balance' evidence: a game value, not an 1805 price. */
  priceMinor: number;
}

export interface PageDef {
  id: string;
  triggerId: string;
  compositionId: string;
  captionId: string;
  /** May be empty for fiction, which then says it is fiction. */
  sourceRefs: string[];
}

export interface WorldDef {
  schemaVersion: typeof SCHEMA_VERSION;
  worldId: typeof WORLD_ID;
  contentVersion: string;
  defaultLocale: 'ja';
  scenes: SceneDef[];
}

// ---------------------------------------------------------------- save

export type Familiarity = 0 | 1 | 2; // 初めて / 顔なじみ / 気の置けない間柄

export interface JournalEntry {
  pageId: string;
  compositionId: string;
  titleStyle: string;
  /** ISO time the page was made. */
  madeAt: string;
}

export type TimeOfDay = 'morning' | 'noon' | 'evening';
/** 'auto' follows the story; a reached time may be chosen to go back to (spec §11). */
export type TimeChoice = 'auto' | TimeOfDay;

export interface Settings {
  reduceMotion: boolean;
  textScale: 1 | 1.25 | 1.5;
  timeChoice?: TimeChoice;
}

export interface SaveData {
  schemaVersion: typeof SCHEMA_VERSION;
  worldId: typeof WORLD_ID;
  saveVersion: number;
  updatedAt: string;
  progress: {
    quests: Record<string, QuestState>;
    flags: string[];
    familiarity: Record<string, { level: Familiarity; events: string[] }>;
  };
  wallet: {
    currencyId: 'mon';
    balanceMinor: number;
    /** Each reward id is paid once, ever (spec §11). */
    grantedRewardIds: string[];
  };
  journal: { pages: JournalEntry[] };
  settings: Settings;
}
