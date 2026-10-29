import { describe, expect, it } from 'vitest';
import { SHARE_IMAGE, shareCopy, shareTags } from '../share-meta';

const content = (tags: ReturnType<typeof shareTags>, key: string) =>
  tags.find((t) => t.attrs?.property === key || t.attrs?.name === key)?.attrs?.content;

describe('share metadata', () => {
  it('describes the world on want.world', () => {
    const tags = shareTags('poc-r1');
    expect(content(tags, 'og:title')).toBe('Wonderful World');
    expect(content(tags, 'description')).toContain('一条小鱼便有了生命');
    expect(content(tags, 'twitter:card')).toBe('summary_large_image');
  });

  it('says a fish was sent on the gift site', () => {
    expect(shareCopy('poc-gift-r1').title).toContain('送了你一条鱼');
    expect(content(shareTags('poc-gift-r1'), 'og:description')).toBe('一位朋友送了你一条鱼。');
  });

  it('points previews at an absolute image URL', () => {
    expect(SHARE_IMAGE).toMatch(/^https:\/\//);
    expect(content(shareTags(undefined), 'og:image')).toBe(SHARE_IMAGE);
  });
});
