import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chat, chatStream, DEFAULT_MODEL } from '@/ai/provider/deepseek';

const baseAccount = {
  id: 'deepseek-balance',
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-test',
  modelId: '',
  extraHeadersJson: ''
};

function makeResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: vi.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
    json: vi.fn(async () => body),
    body: null
  };
}

describe('ai/provider/deepseek', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('非流式 chat：拼装请求并解析返回', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({
        id: 'chatcmpl-1',
        model: 'deepseek-chat',
        choices: [
          { index: 0, message: { role: 'assistant', content: '你好' }, finish_reason: 'stop' }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await chat(
      [
        { role: 'system', content: 's' },
        { role: 'user', content: 'hi' }
      ],
      { account: baseAccount }
    );

    expect(result.content).toBe('你好');
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 3, totalTokens: 8 });
    expect(result.model).toBe('deepseek-chat');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const payload = JSON.parse(init.body);
    expect(payload.stream).toBe(false);
    expect(payload.messages).toHaveLength(2);
    expect(payload.model).toBe(DEFAULT_MODEL);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
  });

  it('account 上指定 modelId 时优先使用', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await chat([{ role: 'user', content: 'hi' }], {
      account: { ...baseAccount, modelId: 'deepseek-reasoner' }
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.model).toBe('deepseek-reasoner');
  });

  it('HTTP 非 2xx 抛出 ProviderError', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({ error: { message: 'bad key' } }, { ok: false, status: 401 })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      chat([{ role: 'user', content: 'hi' }], { account: baseAccount })
    ).rejects.toMatchObject({ code: 'DEEPSEEK_HTTP_ERROR', status: 401 });
  });

  it('缺少 apiKey 立刻抛错，不发请求', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      chat([{ role: 'user', content: 'hi' }], { account: { ...baseAccount, apiKey: '' } })
    ).rejects.toMatchObject({ code: 'NO_API_KEY' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});