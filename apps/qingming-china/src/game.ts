import { isSaveEnvelope, type QuestStatus } from '../../../packages/scroll-contracts';
import { PAGES, type PageId, type CharacterId } from './content';

export const SAVE_KEY = 'ww:qingming-china:save:v1';
export type QuestId = 'paper' | 'boat' | 'purse';
type Quest = { status: QuestStatus; step: number };
export interface GameState {
  schemaVersion: 1; worldId: 'qingming-china'; saveVersion: 1; updatedAt: string;
  started: boolean; wallet: number; journal: PageId[]; claimed: QuestId[];
  progress: { quests: Record<QuestId, Quest>; ropes: number[]; clues: string[]; visited: CharacterId[]; tea: boolean; route: 'deliver' | 'observe' | null; favorite: PageId | null; purchases: string[]; observations: string[]; designs: Partial<Record<PageId, { close: boolean; decoration: string }>> };
  settings: { reduced: boolean; largeText: boolean; hints: boolean; sound: boolean; ambience: number; effects: number };
}
export type Action =
  | { type: 'START' } | { type: 'VISIT'; id: CharacterId } | { type: 'PRESS_PAPER' }
  | { type: 'SKETCH'; view: 'hands' | 'boats' | 'bridge'; close?: boolean; decoration?: string }
  | { type: 'ROPE'; rope: number; target: number } | { type: 'TAG'; tag: string }
  | { type: 'BOAT_END'; route: 'deliver' | 'observe' } | { type: 'FIND_PURSE' }
  | { type: 'EXAMINE_PURSE' } | { type: 'ASK'; who: 'he' | 'cheng' }
  | { type: 'RETURN_PURSE'; who: CharacterId } | { type: 'TEA'; selections: number[] }
  | { type: 'OBSERVE'; id: string; page?: PageId } | { type: 'FAVORITE'; page: PageId }
  | { type: 'DEPART' } | { type: 'BUY'; item: 'tea' | 'bookmark' }
  | { type: 'SETTINGS'; settings: Partial<GameState['settings']> } | { type: 'REPLAY'; quest: QuestId };

export function initialState(): GameState {
  return { schemaVersion: 1, worldId: 'qingming-china', saveVersion: 1, updatedAt: new Date().toISOString(), started: false,
    wallet: 60, journal: [], claimed: [], progress: { quests: { paper: { status: 'unseen', step: 0 }, boat: { status: 'unseen', step: 0 }, purse: { status: 'unseen', step: 0 } }, ropes: [], clues: [], visited: [], tea: false, route: null, favorite: null, purchases: [], observations: [], designs: {} },
    settings: { reduced: false, largeText: false, hints: true, sound: false, ambience: 0.3, effects: 0.4 } };
}
function addPage(s: GameState, id: PageId) { if (!s.journal.includes(id)) s.journal.push(id); }
function complete(s: GameState, id: QuestId, reward: number) {
  s.progress.quests[id].status = 'complete';
  if (!s.claimed.includes(id)) { s.claimed.push(id); s.wallet = Math.min(Number.MAX_SAFE_INTEGER, s.wallet + reward); }
}
export function reduceGame(state: GameState, action: Action): GameState {
  const s: GameState = structuredClone(state);
  const p = s.progress;
  const q = p.quests;
  switch (action.type) {
    case 'START': s.started = true; break;
    case 'VISIT': {
      if (!p.visited.includes(action.id)) p.visited.push(action.id);
      const id = action.id === 'liu' ? 'paper' : action.id === 'zhou' ? 'boat' : action.id === 'chen' ? 'purse' : null;
      if (id && q[id].status === 'unseen') q[id].status = 'discovered';
      break;
    }
    case 'PRESS_PAPER': if (q.paper.step === 0) { q.paper.step = 1; q.paper.status = 'ready'; } break;
    case 'SKETCH': if (q.paper.step >= 1) { const id:PageId=`paper-${action.view}`; addPage(s, id); p.designs[id]={close:action.close??false,decoration:['春日小记','河上清风','人间烟火'].includes(action.decoration??'')?action.decoration!:'春日小记'}; q.paper.step = 2; complete(s, 'paper', 12); } break;
    case 'ROPE': if (q.boat.step === 0 && action.rope === action.target && [0, 1, 2].includes(action.rope)) {
      if (!p.ropes.includes(action.rope)) p.ropes.push(action.rope);
      q.boat.status = 'active';
      if (p.ropes.length === 3) q.boat.step = 1;
    } break;
    case 'TAG': if (q.boat.step === 1 && action.tag === 'tea') { q.boat.step = 2; q.boat.status = 'ready'; } break;
    case 'BOAT_END': if (q.boat.step === 2) {
      p.route = action.route; q.boat.step = 3; complete(s, 'boat', 24);
      addPage(s, action.route === 'deliver' ? 'river-delivery' : 'river-team');
    } break;
    case 'FIND_PURSE': if (q.purse.step === 0) { q.purse.step = 1; q.purse.status = 'active'; } break;
    case 'EXAMINE_PURSE': if (q.purse.step === 1) q.purse.step = 2; break;
    case 'ASK': if (q.purse.step >= 2 && !p.clues.includes(action.who)) {
      p.clues.push(action.who);
      if (p.clues.length === 2) { q.purse.step = 3; q.purse.status = 'ready'; }
    } break;
    case 'RETURN_PURSE': if (q.purse.step === 3 && action.who === 'chen') { q.purse.step = 4; complete(s, 'purse', 18); addPage(s, 'purse'); } break;
    case 'TEA': if (action.selections[0] === 0 && action.selections[1] === 2) { p.tea = true; addPage(s, 'tea-seat'); } break;
    case 'OBSERVE': if (!p.observations.includes(action.id)) p.observations.push(action.id); if (action.page) addPage(s, action.page); break;
    case 'FAVORITE': if (s.journal.includes(action.page)) { p.favorite = action.page; addPage(s, 'master'); } break;
    case 'DEPART': if (s.journal.length > 0) addPage(s, 'departure'); break;
    case 'BUY': { const cost = action.item === 'tea' ? 6 : 12; if (s.wallet >= cost) { s.wallet -= cost; p.purchases.push(action.item); } break; }
    case 'SETTINGS': s.settings = { ...s.settings, ...action.settings }; break;
    case 'REPLAY': if (s.claimed.includes(action.quest)) {
      q[action.quest] = { status: 'replay', step: 0 };
      if (action.quest === 'boat') { p.ropes = []; p.route = null; }
      if (action.quest === 'purse') p.clues = [];
    } break;
  }
  s.updatedAt = new Date().toISOString();
  return s;
}

/** The boat story as it actually happened, from the album (a replay clears the current route). */
export function boatSummary(journal: readonly PageId[]): string {
  const delivered=journal.includes('river-delivery'), watched=journal.includes('river-team');
  if(delivered&&watched)return '你理好绳索、认出货签。一回随阿成把新茶送到何娘手里，一回站在岸边看周伯与阿成接过这一船日常。';
  if(delivered)return '你理好绳索、认出货签，随阿成把新茶送到了何娘手里。';
  return '你理好绳索、认出货签，站在岸边看周伯与阿成接过这一船日常。';
}
const questIds: QuestId[] = ['paper', 'boat', 'purse'];
const characterIds = ['liu', 'zhou', 'cheng', 'he', 'chen', 'shen'];
const statuses = ['unseen', 'discovered', 'active', 'ready', 'complete', 'replay'];
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
export function parseSave(raw: string): GameState {
  const v = JSON.parse(raw);
  // Version 0 had the same progress structure but no per-channel audio settings.
  if (v?.saveVersion === 0 && v?.worldId === 'qingming-china') {
    v.saveVersion = 1;
    v.settings = { ...v.settings, ambience: 0.3, effects: 0.4 };
  }
  if (!isSaveEnvelope(v, 'qingming-china') || v.saveVersion !== 1) throw new Error('这份存档不属于汴河拾光，或版本暂不支持。');
  const s = v as GameState;
  const p = s.progress;
  if (!Object.prototype.hasOwnProperty.call(p, 'designs')) p.designs = {};
  if (typeof s.started !== 'boolean' || !strings(s.claimed) || !s.claimed.every(x => questIds.includes(x)) ||
    !s.journal.every(id => PAGES.some(page => page.id === id)) || new Set(s.journal).size !== s.journal.length ||
    !p.quests || !questIds.every(id => p.quests[id] && statuses.includes(p.quests[id].status) && Number.isInteger(p.quests[id].step) && p.quests[id].step >= 0 && p.quests[id].step <= ({ paper: 2, boat: 3, purse: 4 }[id])) ||
    !Array.isArray(p.ropes) || !p.ropes.every(n => [0, 1, 2].includes(n)) || new Set(p.ropes).size !== p.ropes.length ||
    !strings(p.clues) || !p.clues.every(x => ['he', 'cheng'].includes(x)) || new Set(p.clues).size !== p.clues.length ||
    !strings(p.visited) || !p.visited.every(x => characterIds.includes(x)) || typeof p.tea !== 'boolean' ||
    ![null, 'deliver', 'observe'].includes(p.route) || !(p.favorite === null || s.journal.includes(p.favorite)) ||
    !strings(p.purchases) || !p.purchases.every(x => ['tea', 'bookmark'].includes(x)) || !strings(p.observations) ||
    !p.designs || typeof p.designs !== 'object' || Array.isArray(p.designs) || !Object.entries(p.designs).every(([id, design]) => s.journal.includes(id as PageId) && design && typeof design.close === 'boolean' && ['春日小记','河上清风','人间烟火'].includes(design.decoration)) ||
    !['reduced', 'largeText', 'hints', 'sound'].every(k => typeof s.settings[k as keyof typeof s.settings] === 'boolean') ||
    !['ambience', 'effects'].every(k => { const n = s.settings[k as 'ambience' | 'effects']; return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1; })) {
    throw new Error('存档内容不完整，原来的进度已保留。');
  }
  // Reject inconsistent completion ledgers, including saves that could reissue rewards.
  if (new Set(s.claimed).size !== s.claimed.length || !questIds.every(id => {
    const quest = p.quests[id]; const max = { paper: 2, boat: 3, purse: 4 }[id];
    return (quest.status !== 'complete' || (s.claimed.includes(id) && quest.step === max)) &&
      (quest.step !== max || (quest.status === 'complete' && s.claimed.includes(id))) &&
      (!s.claimed.includes(id) || ['complete', 'replay', 'active', 'ready'].includes(quest.status));
  })) throw new Error('存档的故事记录不一致，原来的进度已保留。');
  return s;
}
export function readSave(): { state: GameState; error?: string; damaged?: string } {
  try { const raw = localStorage.getItem(SAVE_KEY); return { state: raw ? parseSave(raw) : initialState() }; }
  catch (e) {
    let damaged: string | undefined;
    try { damaged = localStorage.getItem(SAVE_KEY) ?? undefined; } catch { /* storage unavailable */ }
    return { state: initialState(), damaged, error: e instanceof Error ? e.message : '浏览器存储暂不可用。' };
  }
}
