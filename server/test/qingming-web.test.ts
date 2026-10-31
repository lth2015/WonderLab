import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

const html = { accept: 'text/html' };

describe('中国篇与江户篇同域隔离', () => {
  let app: FastifyInstance;
  let dir: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'qingming-paths-'));
    writeFileSync(join(dir, 'index.html'), '<title>Wonderful World</title>');
    for (const [path, title] of [['qingming', '汴河拾光'], ['edo', '日本橋、ひと頁']]) {
      mkdirSync(join(dir, path, 'assets'), { recursive: true });
      writeFileSync(join(dir, path, 'index.html'), `<title>${title}</title>`);
      writeFileSync(join(dir, path, 'assets', 'scene-123.js'), `// ${title}`);
    }
    app = await buildServer({ config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', WEB_DIST_DIR: dir }), chat: async () => ({ status: 'error' as const, code: 'unused' }) });
  });
  afterAll(async () => { await app.close(); rmSync(dir, { recursive: true }); });

  it.each([['/', 'Wonderful World'], ['/edo/', '日本橋、ひと頁'], ['/qingming/', '汴河拾光'], ['/qingming/?scene=tea', '汴河拾光']])('分别从 %s 进入对应作品', async (url, title) => {
    const page = await app.inject({ url, headers: html });
    expect(page.statusCode).toBe(200);
    expect(page.body).toBe(`<title>${title}</title>`);
    expect(page.headers['cache-control']).toBe('no-cache');
  });
  it('无尾斜线时保留场景查询并跳转到正确的资源基础路径', async () => {
    const page = await app.inject({ url: '/qingming?scene=tea', headers: html });
    expect(page.statusCode).toBe(301);
    expect(page.headers.location).toBe('/qingming/?scene=tea');
  });
  it.each(['qingming', 'edo'])('%s 的资源在自己的路径加载和缓存', async path => {
    const asset = await app.inject({ url: `/${path}/assets/scene-123.js` });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    expect((await app.inject({ url: `/${path}/assets/missing.js`, headers: html })).statusCode).toBe(404);
  });
  it('相似的路径名称不会误入中国篇', async () => {
    const page = await app.inject({ url: '/qingming-other', headers: html });
    expect(page.body).toContain('Wonderful World');
  });
});
