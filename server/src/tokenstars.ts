// TokenStars client (OpenAI-compatible), following yuha's adapter
// (lth2015/yuha packages/providers/src/text/tokenstars.ts): POST
// {base}/v1/chat/completions with a Bearer key, `response_format:
// json_object` (verified there against the live API), and Azure's
// `finish_reason: 'content_filter'` read as a refusal. The model id always
// comes from configuration, never guessed.
//
// Used by the scene route and by scripts/gen-art.mjs. The image endpoint is
// OpenAI's; that TokenStars serves it is an assumption until checked.

export interface TokenStarsConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  imageModel: string;
  chatPath: string;
  imagePath: string;
  requestIdHeader: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): TokenStarsConfig {
  return {
    baseUrl: env.TOKENSTARS_BASE_URL || 'https://www.tokenstars.ai',
    apiKey: env.TOKENSTARS_API_KEY || '',
    model: env.TOKENSTARS_MODEL_ID || '',
    imageModel: env.TOKENSTARS_IMAGE_MODEL_ID || '',
    chatPath: env.TOKENSTARS_CHAT_PATH || '/v1/chat/completions',
    imagePath: env.TOKENSTARS_IMAGE_PATH || '/v1/images/generations',
    requestIdHeader: env.TOKENSTARS_REQUEST_ID_HEADER || 'x-request-id',
  };
}

interface Reply {
  ok: boolean;
  status: number;
  json: unknown;
  text: string;
  requestId: string | null;
}

async function post(cfg: TokenStarsConfig, path: string, body: unknown, timeoutMs: number): Promise<Reply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(path, cfg.baseUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text: text.slice(0, 500), requestId: res.headers.get(cfg.requestIdHeader) };
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ChatResult =
  | { status: 'ok'; value: unknown; usage: unknown }
  | { status: 'refused' | 'failed'; code: string; requestId?: string | null };

/** temperature: null leaves it out, for models that only take their default (e.g. gpt-6-luna). */
export type ChatJson = (messages: ChatMessage[], opts?: { maxTokens?: number; temperature?: number | null; timeoutMs?: number }) => Promise<ChatResult>;

/** One chat round trip that must come back as a JSON object. */
export function chatJsonWith(cfg: TokenStarsConfig): ChatJson {
  return async (messages, { maxTokens = 300, temperature = 0.5, timeoutMs = 8000 } = {}) => {
    if (!cfg.apiKey || !cfg.model) return { status: 'failed', code: 'not_configured' };
    let res: Reply;
    try {
      res = await post(
        cfg,
        cfg.chatPath,
        { model: cfg.model, messages, ...(temperature === null ? {} : { temperature }), max_tokens: maxTokens, response_format: { type: 'json_object' } },
        timeoutMs,
      );
    } catch (err) {
      return { status: 'failed', code: (err as Error).name === 'AbortError' ? 'timeout' : 'unreachable' };
    }
    if (!res.ok) return { status: 'failed', code: `http_${res.status}`, requestId: res.requestId };
    const choice = (res.json as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] } | null)?.choices?.[0];
    if (choice?.finish_reason === 'content_filter') return { status: 'refused', code: 'content_filter' };
    if (choice?.finish_reason === 'length') return { status: 'failed', code: 'truncated' };
    const content = typeof choice?.message?.content === 'string' ? choice.message.content : '';
    try {
      const value = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
      return { status: 'ok', value, usage: (res.json as { usage?: unknown }).usage ?? null };
    } catch {
      return { status: 'failed', code: 'not_json' };
    }
  };
}

/** Generate one image; resolves to PNG bytes or throws. */
export async function generateImage(
  cfg: TokenStarsConfig,
  { prompt, size, quality = 'medium', background }: { prompt: string; size: string; quality?: string; background?: string },
): Promise<Buffer> {
  if (!cfg.apiKey || !cfg.imageModel) throw new Error('TOKENSTARS_API_KEY and TOKENSTARS_IMAGE_MODEL_ID must be set');
  const body: Record<string, unknown> = { model: cfg.imageModel, prompt, size, quality, n: 1 };
  if (background) body.background = background;
  const res = await post(cfg, cfg.imagePath, body, 180000);
  if (!res.ok) throw new Error(`image request failed: HTTP ${res.status} ${res.text}`);
  const item = (res.json as { data?: { b64_json?: string; url?: string }[] } | null)?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error('image response had neither b64_json nor url');
}
