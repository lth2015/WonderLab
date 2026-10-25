import { BUILD } from './build';
import { validateCommand, type SceneCommand } from './engine/intent';

// The AI half of 一句成境 (docs/02 §5.3): ask the server proxy, which holds
// the TokenStars key, to read the sentence. Only invited testers have it on
// (docs/01 P9): the invite arrives as #invite=… (or ?invite=…), is kept on
// this device and removed from the address at once.

const INVITE_KEY = 'wonderlab.invite';
export const AI_TIMEOUT_MS = 2500;
const API = import.meta.env.VITE_API_BASE ?? '';

export type AiOutcome =
  | { status: 'ok'; command: SceneCommand; echoId: number | null }
  | { status: 'limited' | 'timeout' | 'failed' | 'off' };

export function captureInvite(params: URLSearchParams): string | null {
  // Invite links carry the token after #, which browsers never send to a
  // server, so it stays out of every request log on the way (docs/deploy.md).
  // ?invite= still works for links already handed out.
  const hash = new URLSearchParams(location.hash.slice(1));
  const found = hash.get('invite') ?? params.get('invite');
  if (found) {
    try {
      localStorage.setItem(INVITE_KEY, found);
    } catch {
      // Private mode: the invite lasts this page only.
    }
    hash.delete('invite');
    params.delete('invite');
    const q = bareFlags(params);
    const h = bareFlags(hash);
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + (h ? `#${h}` : ''));
    return found;
  }
  try {
    return localStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

/** `fresh&mod`, not `fresh=&mod=`: flags read the same either way, and look like what was typed. */
export function bareFlags(params: URLSearchParams): string {
  return params.toString().replace(/=(?=&|$)/g, '');
}

/** One sentence to the proxy, within the 2.5 s budget (docs/03 §6.3). */
export async function askScene(invite: string | null, text: string, shortlist: number[]): Promise<AiOutcome> {
  // An experiment build reads sentences with local rules only: nothing is sent, invite or not.
  if (BUILD.scene === 'local' || !invite) return { status: 'off' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/api/scene`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Invite ${invite}` },
      body: JSON.stringify({ text, shortlist }),
      signal: controller.signal,
    });
    if (res.status === 429) return { status: 'limited' };
    if (!res.ok) return { status: 'failed' };
    const body = (await res.json()) as { command?: unknown; echoId?: unknown };
    const echoId = typeof body.echoId === 'number' && shortlist.includes(body.echoId) ? body.echoId : null;
    return { status: 'ok', command: validateCommand(body.command), echoId };
  } catch (err) {
    return { status: (err as Error).name === 'AbortError' ? 'timeout' : 'failed' };
  } finally {
    clearTimeout(timer);
  }
}
