import { describe, expect, it, vi } from 'vitest';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';
import type { ChatJson } from '../src/tokenstars';
import { Usage } from '../src/usage';

const INVITE = 'invite-abcdef-123';

function config(extra: Record<string, string> = {}) {
  return loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', INVITE_TOKENS: INVITE, ...extra });
}

async function server(chat: ChatJson, extra: Record<string, string> = {}, usage?: Usage) {
  return buildServer({ config: config(extra), chat, usage });
}

const ask = (text = '下雨了', shortlist = [1, 2, 3], headers: Record<string, string> = { authorization: `Invite ${INVITE}` }) => ({
  method: 'POST' as const,
  url: '/api/scene',
  headers,
  payload: { text, shortlist },
});

describe('POST /api/scene', () => {
  it('returns a validated command and an echo from the shortlist', async () => {
    const chat = vi.fn<ChatJson>(async () => ({ status: 'ok', value: { weather: 'rain', palette: 'neon', wind: 2, echoId: 2 }, usage: null }));
    const app = await server(chat);
    const res = await app.inject(ask());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ command: { weather: 'rain', wind: 1 }, echoId: 2 });
    // The visitor's words go to the model as data, alongside the shortlist.
    const [messages] = chat.mock.calls[0];
    expect(messages[1].content).toContain('下雨了');
    expect(messages[1].content).toContain('2: ');
  });

  it('drops an echo id outside the shortlist', async () => {
    const app = await server(async () => ({ status: 'ok', value: { echoId: 99 }, usage: null }));
    expect((await app.inject(ask())).json().echoId).toBeNull();
  });

  it('needs a valid invite', async () => {
    const chat = vi.fn<ChatJson>();
    const app = await server(chat);
    expect((await app.inject(ask('下雨了', [1], {}))).statusCode).toBe(401);
    expect((await app.inject(ask('下雨了', [1], { authorization: 'Invite wrong-token-x' }))).statusCode).toBe(401);
    expect(chat).not.toHaveBeenCalled();
  });

  it('rejects other origins when origins are configured', async () => {
    const app = await server(async () => ({ status: 'ok', value: {}, usage: null }), { ALLOWED_ORIGINS: 'https://wonderlab.example' });
    const res = await app.inject(ask('下雨了', [1], { authorization: `Invite ${INVITE}`, origin: 'https://evil.example' }));
    expect(res.statusCode).toBe(403);
  });

  it('serves repeats from the cache without a second call', async () => {
    const chat = vi.fn<ChatJson>(async () => ({ status: 'ok', value: { weather: 'mist', echoId: 1 }, usage: null }));
    const app = await server(chat);
    await app.inject(ask('起雾了'));
    const again = await app.inject(ask(' 起雾了 '));
    expect(again.json()).toMatchObject({ command: { weather: 'mist' }, cached: true });
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('stops at the per-invite daily cap with 429', async () => {
    const chat = vi.fn<ChatJson>(async () => ({ status: 'ok', value: {}, usage: null }));
    const app = await server(chat, { SCENE_DAILY_PER_INVITE: '2' });
    expect((await app.inject(ask('一'))).statusCode).toBe(200);
    expect((await app.inject(ask('二'))).statusCode).toBe(200);
    expect((await app.inject(ask('三'))).statusCode).toBe(429);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('answers 503 without charging when TokenStars is not configured', async () => {
    const chat = vi.fn<ChatJson>();
    const usage = new Usage({ dailyPerInvite: 1, dailyBudget: 1, totalBudget: 1, costPerCall: 1 }, null);
    const app = await buildServer({ config: config(), chat, usage, aiReady: false });
    expect((await app.inject(ask())).statusCode).toBe(503);
    expect(usage.snapshot().spentTotal).toBe(0);
    expect(chat).not.toHaveBeenCalled();
  });

  it('reports a refusal and a failure without passing them on as scenes', async () => {
    const refused = await server(async () => ({ status: 'refused', code: 'content_filter' }));
    expect((await refused.inject(ask())).statusCode).toBe(422);
    const failed = await server(async () => ({ status: 'failed', code: 'timeout' }));
    expect((await failed.inject(ask())).statusCode).toBe(502);
  });
});

describe('Usage caps', () => {
  const caps = { dailyPerInvite: 100, dailyBudget: 1, totalBudget: 1.5, costPerCall: 0.5 };

  it('enforces the site daily and the total budget, and rolls over each day', () => {
    let day = '2026-10-21';
    const u = new Usage(caps, null, () => day);
    expect(u.charge('a')).toEqual({ ok: true });
    expect(u.charge('b')).toEqual({ ok: true });
    expect(u.charge('c')).toEqual({ ok: false, reason: 'site_daily' });
    day = '2026-10-22';
    expect(u.charge('a')).toEqual({ ok: true });
    expect(u.charge('a')).toEqual({ ok: false, reason: 'total_budget' });
  });
});
