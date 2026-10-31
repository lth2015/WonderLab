import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Serving the built web app from the API's own origin (WEB_DIST_DIR), so a
 * test deployment is one process: the page, /api/scene and, when there is a
 * database, /v1. Same origin means no CORS and no VITE_API_BASE at build
 * time. Without WEB_DIST_DIR the API serves no pages, as before.
 *
 * Hashed files under /assets never change and are cached for a year; the
 * page and everything else is revalidated, so a new deployment is picked up
 * on the next load.
 */
/**
 * Works built into a folder of their own under the web root, each with its
 * own index.html: dist/edo/ is 清明上河図：江戸編 at /edo/ (apps/qingming-edo,
 * docs/painted-worlds/qingming-edo). A page address inside one gets that
 * work's page, never the main app's.
 */
let subApps: string[] = [];

export async function registerWeb(app: FastifyInstance, dir: string): Promise<void> {
  const root = resolve(dir);
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(`WEB_DIST_DIR has no index.html: ${root} (run npm run build first)`);
  }
  subApps = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'assets' && existsSync(join(root, d.name, 'index.html')))
    .map((d) => d.name);
  await app.register(fastifyStatic, {
    root,
    wildcard: false,
    index: ['index.html'],
    // Ours below, not the plugin's blanket max-age=0.
    cacheControl: false,
    setHeaders(res, path) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      // The page never needs camera, microphone or location (01 P8): refuse
      // them at the browser level, as deploy/static/_headers does.
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      res.setHeader(
        'Cache-Control',
        /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });
}

/**
 * Whether a request that matched no route should get the page instead of a
 * 404: a GET for something that is not the API, from a browser asking for
 * HTML. That is every client-side address (/checkout/complete,
 * /auth/google/callback, /pricing) loaded directly or after a redirect.
 */
export function wantsPage(req: FastifyRequest): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const path = req.url.split('?')[0];
  if (path === '/api' || path.startsWith('/api/') || path === '/v1' || path.startsWith('/v1/')) return false;
  if (/\.[a-z0-9]+$/i.test(path)) return false; // a missing file stays missing
  return (req.headers.accept ?? '').includes('text/html');
}

/** The work a page address belongs to: a sub-app folder name, or null for the main app. */
export function subAppOf(path: string): string | null {
  const first = path.split('?')[0].split('/')[1] ?? '';
  return subApps.includes(first) ? first : null;
}

export function sendPage(reply: FastifyReply, req?: FastifyRequest): FastifyReply {
  const path = req ? req.url.split('?')[0] : '/';
  const sub = subAppOf(path);
  // /edo → /edo/, so the work's relative asset paths resolve under it.
  if (sub && path === `/${sub}`) return reply.redirect(`/${sub}/` + (req!.url.includes('?') ? req!.url.slice(req!.url.indexOf('?')) : ''), 301);
  return reply.header('Cache-Control', 'no-cache').sendFile(sub ? `${sub}/index.html` : 'index.html');
}
