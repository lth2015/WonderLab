// Gifts already taken in on this device (送一条鱼, docs/02 §5.7): opening the
// same link again does not bring the same fish twice. Ids only, kept here.

const KEY = 'wonderlab.gifts';
const MAX = 200;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function hasReceived(id: string): boolean {
  return read().includes(id);
}

export function markReceived(id: string): void {
  const list = read().filter((x) => x !== id);
  list.push(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Private mode: the same link could bring the fish again; harmless.
  }
}

/**
 * Take a gift out of the address (#gift=…): read it once, then remove it, so
 * a refresh does not replay it and a copied address does not carry it on.
 */
export function takeGiftFromAddress(): string | null {
  const hash = new URLSearchParams(location.hash.slice(1));
  const value = hash.get('gift');
  if (!value) return null;
  hash.delete('gift');
  const h = hash.toString();
  history.replaceState(null, '', location.pathname + location.search + (h ? `#${h}` : ''));
  return value;
}
