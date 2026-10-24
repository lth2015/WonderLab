import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureInvite } from './ai';

let store: Record<string, string>;
let address: string;

function at(path: string, search: string, hash: string) {
  vi.stubGlobal('location', { pathname: path, search, hash });
  vi.stubGlobal('history', { replaceState: (_: unknown, __: string, url: string) => (address = url) });
}

describe('captureInvite', () => {
  beforeEach(() => {
    store = {};
    address = '';
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('takes the invite from after #, keeps it, and clears it from the address', () => {
    at('/', '?fresh&mod', '#invite=tester-token-1');
    const params = new URLSearchParams('?fresh&mod');
    expect(captureInvite(params)).toBe('tester-token-1');
    expect(Object.values(store)).toEqual(['tester-token-1']);
    expect(address).toBe('/?fresh&mod');
    expect(address).not.toContain('tester-token-1');
  });

  it('still reads ?invite= from links already handed out', () => {
    at('/', '?invite=old-link-token&tier=light', '');
    expect(captureInvite(new URLSearchParams('?invite=old-link-token&tier=light'))).toBe('old-link-token');
    expect(address).toBe('/?tier=light');
  });

  it('keeps other fragment parts, and falls back to the remembered invite', () => {
    at('/', '', '#invite=abcdefgh&x=1');
    expect(captureInvite(new URLSearchParams(''))).toBe('abcdefgh');
    expect(address).toBe('/#x=1');
    at('/', '', '');
    expect(captureInvite(new URLSearchParams(''))).toBe('abcdefgh');
  });

  it('has no invite without one', () => {
    at('/', '', '');
    expect(captureInvite(new URLSearchParams(''))).toBeNull();
  });
});
