import { afterEach, describe, expect, it, vi } from 'vitest';

// freshUrl reads location at call time; give it a few addresses.
function at(search: string) {
  vi.stubGlobal('location', { search, pathname: '/' });
}

describe('freshUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts a fresh world and keeps the tier and moderator mode', async () => {
    at('?mod&tier=light&invite=secret');
    const { freshUrl } = await import('./moderator');
    expect(freshUrl()).toBe('/?fresh&tier=light&mod');
  });

  it('adds nothing a plain link did not have', async () => {
    at('');
    const { freshUrl } = await import('./moderator');
    expect(freshUrl()).toBe('/?fresh');
  });
});
