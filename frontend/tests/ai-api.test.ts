import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAiMessages } from '@/lib/ai-api';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ai-api client', () => {
  it('reads conversation messages through the V2 messages endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          conversationId: 'conv-1',
          messages: [{ id: 'msg-1', role: 'user', content: '你好' }]
        })
    });

    const result = await getAiMessages('alpha', 'conv-1');

    expect(result.messages).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/conversations/conv-1/messages?project=alpha',
      expect.any(Object)
    );
  });
});
