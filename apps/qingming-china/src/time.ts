import type { GameState } from './game';

export type TimeOfDay = 'morning' | 'noon' | 'evening';
export type TimeChoice = TimeOfDay | 'auto';
export const TIMES = [
  { id: 'morning', label: '晨光', mark: '晨' },
  { id: 'noon', label: '日和', mark: '昼' },
  { id: 'evening', label: '暮色', mark: '暮' },
] as const;
/** Reaching a time is permanent: replaying a story does not remove its claim. */
export function reachedTimes(game: Pick<GameState, 'claimed'>): TimeOfDay[] {
  return game.claimed.length >= 3 ? ['morning', 'noon', 'evening'] : game.claimed.length ? ['morning', 'noon'] : ['morning'];
}
export function timeOf(game: Pick<GameState, 'claimed' | 'settings'>): typeof TIMES[number] {
  const reached = reachedTimes(game), choice = game.settings.timeChoice ?? 'auto';
  const id = choice !== 'auto' && reached.includes(choice) ? choice : reached.at(-1)!;
  return TIMES.find(time => time.id === id)!;
}
