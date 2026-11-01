// 試遊会 (spec §19: observed playtests with 5–8 people, often on one device).
// `?session=1` plays on its own save key, so a facilitator's device never
// touches the owner's real progress, and keeps this player's playtest log in
// the browser across a reload. 「次の方へ」 clears both and starts fresh.
// Without the parameter nothing changes.

export const SESSION_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('session') === '1';
