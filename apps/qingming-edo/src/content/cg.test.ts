import { describe, expect, it } from 'vitest';
import { cgUrl } from '../ui/Cg';
import { NODES } from './script';

describe('物語の画', () => {
  it('every picture a node names exists, and the story peaks have theirs', () => {
    const named = Object.entries(NODES).filter(([, n]) => n.cg);
    for (const [id, n] of named) expect(cgUrl(n.cg!), id).toBeTruthy();
    expect(NODES['inkyo.arrive'].cg).toBe('inkyo');
    expect(NODES['kisuke.ame.done'].cg).toBe('ame');
    expect(NODES['kame.found'].cg).toBe('kashi');
    expect(NODES['kisuke.yube.done'].cg).toBe('yube');
    expect(NODES['sokichi.hashi.gather'].cg).toBe('hashi');
    // 宗吉 is in the picture: not for the ending where he stands beside the player
    expect(NODES['hashi.side'].cg).toBeUndefined();
    // 作爺さん's room is indoors: no street picture there
    expect(NODES['yube.tell'].cg).toBeUndefined();
    expect(cgUrl('ippuku')).toBeTruthy();
  });

  it('after 橋のたもと, 宗吉 offers to look back over the day', () => {
    expect(NODES['sokichi.hashi.after'].choices!.some((c) => c.epilogue)).toBe(true);
    expect(NODES['sokichi.hashi.after'].choices!.some((c) => c.talk)).toBe(true);
  });
});
