import type { HtmlTagDescriptor, Plugin } from 'vite';

// Link previews and search snippets (docs/deploy-static.md): what a chat app
// or a search engine shows for want.world and gift.want.world. Chosen by the
// build, because on the gift site every shared link is a fish someone sent.
// The image URL is absolute (most link previews ignore relative ones) and
// both sites use the one on want.world.

export const SHARE_IMAGE = 'https://want.world/brand/og-image.png';

export function shareCopy(experiment: string | undefined): { title: string; description: string } {
  if (experiment === 'poc-gift-r1') {
    return { title: '有人送了你一条鱼 · Wonderful World', description: '一位朋友送了你一条鱼。' };
  }
  return {
    title: 'Wonderful World',
    description: '在湖面上画一笔，一条小鱼便有了生命。A little imagination. A wonderful world.',
  };
}

export function shareTags(experiment: string | undefined): HtmlTagDescriptor[] {
  const { title, description } = shareCopy(experiment);
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' });
  return [
    meta({ name: 'description', content: description }),
    meta({ property: 'og:type', content: 'website' }),
    meta({ property: 'og:site_name', content: 'Wonderful World' }),
    meta({ property: 'og:title', content: title }),
    meta({ property: 'og:description', content: description }),
    meta({ property: 'og:image', content: SHARE_IMAGE }),
    meta({ property: 'og:image:width', content: '1200' }),
    meta({ property: 'og:image:height', content: '630' }),
    meta({ property: 'og:image:alt', content: 'Wonderful World' }),
    meta({ name: 'twitter:card', content: 'summary_large_image' }),
    meta({ name: 'twitter:title', content: title }),
    meta({ name: 'twitter:description', content: description }),
    meta({ name: 'twitter:image', content: SHARE_IMAGE }),
  ];
}

export function shareMeta(): Plugin {
  return {
    name: 'wonderful-world-share-meta',
    transformIndexHtml() {
      return shareTags(process.env.WW_EXPERIMENT);
    },
  };
}
