import type { SaveData, TimeChoice, TimeOfDay } from '../contract';
import { questState } from './state';

// 朝・昼・夕 (spec §11). Time moves only at the end of a story, never while the
// player is looking around: no shop closes and no request is missed. Once a
// time has been reached, the player may go back to any reached time.

export const TIMES: { id: TimeOfDay; label: string; arrive: string }[] = [
  { id: 'morning', label: '朝', arrive: '' },
  { id: 'noon', label: '昼', arrive: '日が高くなった。通りの声が、いっそうにぎやかになる。' },
  { id: 'evening', label: '夕', arrive: '西の空が色づいてきた。店先に、夕方の影がのびる。' },
];

export function reachedTimes(s: SaveData): TimeOfDay[] {
  const out: TimeOfDay[] = ['morning'];
  if (questState(s, 'kaze') === 'complete') out.push('noon');
  if (questState(s, 'dougu') === 'complete' && questState(s, 'tenugui') === 'complete') out.push('evening');
  return out;
}

/** The time shown: the player's choice if reached, otherwise the latest reached. */
export function timeOf(s: SaveData): TimeOfDay {
  const reached = reachedTimes(s);
  const choice: TimeChoice = s.settings.timeChoice ?? 'auto';
  return choice !== 'auto' && reached.includes(choice) ? choice : reached[reached.length - 1];
}
