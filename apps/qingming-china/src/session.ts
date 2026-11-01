/** Opt-in facilitator mode. Normal play never reads or clears these session keys. */
export const SESSION_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('session') === '1';
export const NORMAL_SAVE_KEY = 'ww:qingming-china:save:v1';
export const SESSION_SAVE_KEY = `${NORMAL_SAVE_KEY}:session`;
export const SESSION_STUDY_KEY = 'ww:qingming-china:study:session';
export const SAVE_KEY = SESSION_MODE ? SESSION_SAVE_KEY : NORMAL_SAVE_KEY;

/** Clear only the two playtest keys; a failed clear must not mix two players. */
export function clearSessionKeys(store: Pick<Storage, 'removeItem' | 'getItem'>): void {
  store.removeItem(SESSION_SAVE_KEY);
  store.removeItem(SESSION_STUDY_KEY);
  if (store.getItem(SESSION_SAVE_KEY) !== null || store.getItem(SESSION_STUDY_KEY) !== null) throw new Error('session clear failed');
}
