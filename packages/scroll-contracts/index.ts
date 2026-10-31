/** Proposed v1 contract. No runtime dependency on either world's content. */
export type WorldId = 'qingming-china' | 'qingming-edo';
export type EvidenceType = 'observed' | 'historical' | 'fiction' | 'balance';
export type QuestStatus = 'unseen' | 'discovered' | 'active' | 'ready' | 'complete' | 'replay';
export interface Point { x: number; y: number }
export interface Hotspot { id: string; targetId: string; anchor: Point; hitArea: { width: number; height: number }; priority: number; visibleWhen: 'always' | 'started' }
export interface Scene { id: string; bounds: { x: number; y: number; width: number; height: number }; layers: string[]; hotspots: Hotspot[]; ambienceId: string }
export interface ScrollWorld { schemaVersion: 1; worldId: WorldId; contentVersion: string; defaultLocale: string; scenes: Scene[] }
export interface ScrollSave { schemaVersion: 1; worldId: WorldId; saveVersion: number; updatedAt: string; progress: unknown; wallet: number; journal: string[]; settings: unknown }
export function isSaveEnvelope(value: unknown, world: WorldId): value is ScrollSave {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return s.schemaVersion === 1 && s.worldId === world && Number.isInteger(s.saveVersion) &&
    typeof s.updatedAt === 'string' && Number.isFinite(Date.parse(s.updatedAt)) && Number.isSafeInteger(s.wallet) &&
    (s.wallet as number) >= 0 && Array.isArray(s.journal) && s.journal.every(v => typeof v === 'string') &&
    !!s.progress && typeof s.progress === 'object' && !!s.settings && typeof s.settings === 'object';
}
