import type { PageId } from './content';

const sceneOf = (id: PageId) => id.startsWith('paper-') ? 'paper' : id.startsWith('river-') ? 'bridge' : id === 'harbor-space' ? 'harbor' : ['tea-seat', 'purse', 'market'].includes(id) ? 'tea' : 'bridge';

/** Construct from a configured work URL, never forward the current query/hash. */
export function journalLink(id: PageId, current: string, configured?: string): string {
  const fallback = new URL('./', current);
  let url = fallback;
  if (configured) {
    try {
      const candidate = new URL(configured);
      if (candidate.protocol === 'https:' && !candidate.username && !candidate.password) url = candidate;
    } catch { /* retain this work's current origin and base path */ }
  }
  url.search = ''; url.hash = '';
  url.searchParams.set('world', 'qingming-china');
  url.searchParams.set('scene', sceneOf(id));
  url.searchParams.set('source', 'journal');
  return url.toString();
}

export const publicJournalLink = (id: PageId) => journalLink(id, location.href, import.meta.env.VITE_QINGMING_PUBLIC_URL);
