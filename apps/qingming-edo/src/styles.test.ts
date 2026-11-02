import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A lost `}` (as after a merge) nests every later rule under the one left open:
// the build still passes, but those styles silently stop applying.
describe('styles.css', () => {
  it('closes every block it opens', () => {
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    let line = 1;
    const open: number[] = [];
    for (const ch of css) {
      if (ch === '\n') line++;
      else if (ch === '{') open.push(line), depth++;
      else if (ch === '}') {
        open.pop();
        depth--;
        expect(depth, `extra } at line ${line}`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(open, 'blocks left open (line numbers, comments removed)').toEqual([]);
  });
});
