import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

// One-process deployment: the API serves the built web app (WEB_DIST_DIR).

const chat = async () => ({ status: 'error' as const, code: 'unused' });
const html = { accept: 'text/html,application/xhtml+xml' };

describe('serving the web app', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wl-dist-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>万象生</title>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
    app = await buildServer({ config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', WEB_DIST_DIR: dir }), chat });
  });
  afterAll(() => app.close());

  it('serves the page at the root, revalidated every load', async () => {
    const res = await app.inject({ url: '/', headers: html });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('万象生');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('turns off camera, microphone and location for the page and client-side addresses', async () => {
    for (const url of ['/', '/pricing']) {
      const res = await app.inject({ url, headers: html });
      expect(res.headers['permissions-policy'], url).toBe('camera=(), microphone=(), geolocation=()');
    }
  });

  it('caches hashed assets for good', async () => {
    const res = await app.inject({ url: '/assets/index-abc123.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('answers client-side addresses with the page', async () => {
    for (const url of ['/checkout/complete?order_id=x', '/auth/google/callback?code=y', '/pricing']) {
      const res = await app.inject({ url, headers: html });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).toContain('万象生');
    }
  });

  it('keeps the API answering as an API', async () => {
    expect((await app.inject({ url: '/api/health', headers: html })).json()).toMatchObject({ ok: true });
    const missing = await app.inject({ url: '/api/nothing', headers: html });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
    expect((await app.inject({ url: '/v1/nothing', headers: html })).statusCode).toBe(404);
  });

  it('lets a missing file stay missing, and does not answer non-browsers with HTML', async () => {
    expect((await app.inject({ url: '/missing.png', headers: html })).statusCode).toBe(404);
    expect((await app.inject({ url: '/pricing', headers: { accept: 'application/json' } })).statusCode).toBe(404);
  });
});

describe('without WEB_DIST_DIR', () => {
  it('serves no pages, as before', async () => {
    const app = await buildServer({ config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }), chat });
    expect((await app.inject({ url: '/pricing', headers: html })).statusCode).toBe(404);
    await app.close();
  });

  it('refuses to start pointed at a folder with no build in it', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'wl-empty-'));
    await expect(buildServer({ config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', WEB_DIST_DIR: empty }), chat })).rejects.toThrow(/index.html/);
  });
});
