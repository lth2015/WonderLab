import { describe, expect, it } from 'vitest';
import { cgUrl } from '../ui/Cg';
import { NODES } from './script';

describe('物語の画', () => {
  it('every picture a node names exists, and the story peaks have theirs', () => {
    const named = Object.entries(NODES).filter(([, n]) => n.cg);
    for (const [id, n] of named) expect(cgUrl(n.cg!), id).toBeTruthy();
    expect(NODES['inkyo.arrive'].cg).toBe('inkyo');
    expect(NODES['kisuke.ame.done'].cg).toBe('ame');
    expect(cgUrl('ippuku')).toBeTruthy();
  });
});
