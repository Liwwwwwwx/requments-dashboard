import { authFetch } from './auth';
import type {
  AiAccount,
  AiChatResult,
  AiConversation,
  AiMessage,
  AiProposal
} from './ai-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body?.message || body?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function listAiAccounts(): Promise<{ ok: true; accounts: AiAccount[] }> {
  return fetchJson('/ai/accounts');
}

export async function listAiConversations(
  project: string
): Promise<{ ok: true; conversations: AiConversation[] }> {
  return fetchJson(
    `/ai/conversations?project=${encodeURIComponent(project)}`
  );
}

export async function getAiConversation(
  project: string,
  conversationId: string
): Promise<{ ok: true; conversation: AiConversation; messages: AiMessage[] }> {
  return fetchJson(
    `/ai/conversations/${encodeURIComponent(
      conversationId
    )}?project=${encodeURIComponent(project)}`
  );
}

export async function getAiMessages(
  project: string,
  conversationId: string
): Promise<{ ok: true; conversationId: string; messages: AiMessage[] }> {
  return fetchJson(
    `/ai/conversations/${encodeURIComponent(
      conversationId
    )}/messages?project=${encodeURIComponent(project)}`
  );
}

export async function createAiConversation(
  project: string,
  body: { requirementId?: string; title?: string; model?: string; accountId?: string } = {}
): Promise<{ ok: true; conversation: AiConversation }> {
  return fetchJson(
    `/ai/conversations?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
}

export async function sendAiMessage(
  project: string,
  conversationId: string,
  body: { text: string; model?: string; accountId?: string }
): Promise<AiChatResult> {
  return fetchJson(
    `/ai/conversations/${encodeURIComponent(
      conversationId
    )}/messages?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
}

/**
 * 流式发送消息。返回 AbortController，调用 abort() 可中断。
 *
 * 事件协议（来自后端 ai/stream.js）：
 *   event: user      data: { message }
 *   event: start     data: { messageId, conversationId, model }
 *   event: delta     data: { delta }
 *   event: usage     data: { inputTokens, outputTokens, totalTokens }
 *   event: done      data: { message, usage, model }
 *   event: aborted   data: { reason }
 *   event: error     data: { code, message }
 */
export interface StreamHandle {
  abort: () => void;
  promise: Promise<{ message: AiMessage; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }>;
}

export function sendAiMessageStream(
  project: string,
  conversationId: string,
  body: {
    text: string;
    model?: string;
    accountId?: string;
    toolsEnabled?: boolean;
  },
  handlers: {
    onUser?: (message: AiMessage) => void;
    onStart?: (info: { messageId: string; conversationId: string; model: string }) => void;
    onDelta?: (delta: string) => void;
    onUsage?: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
    onProposal?: (proposal: { proposalId: string; rationale: string; events: unknown[]; errors: string[] | null }) => void;
    onTitled?: (info: { conversationId: string; title: string | null }) => void;
    onDone?: (info: { message: AiMessage; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }) => void;
    onAborted?: (reason: string) => void;
    onError?: (err: { code: string; message: string }) => void;
  } = {}
): StreamHandle {
  const controller = new AbortController();

  const promise = (async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    };
    const res = await authFetch(
      `${API_BASE}/ai/conversations/${encodeURIComponent(
        conversationId
      )}/messages/stream?project=${encodeURIComponent(project)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: body.text, model: body.model, accountId: body.accountId, toolsEnabled: body.toolsEnabled }),
        signal: controller.signal
      }
    );

    if (!res.ok) {
      const text = await res.text();
      let detail = text;
      try {
        detail = JSON.parse(text)?.message || detail;
      } catch {
        // ignore
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    if (!res.body) throw new Error('响应无 body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let doneMessage: AiMessage | null = null;
    let doneUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按 \n\n 切分 event
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseSseEvent(rawEvent);
        if (!parsed) continue;
        const { event, data } = parsed;
        switch (event) {
          case 'user':
            handlers.onUser?.((data as { message: AiMessage }).message);
            break;
          case 'start': {
            const d = data as { messageId: string; conversationId: string; model: string };
            handlers.onStart?.(d);
            break;
          }
          case 'delta':
            handlers.onDelta?.((data as { delta: string }).delta);
            break;
          case 'usage': {
            const d = data as { inputTokens: number; outputTokens: number; totalTokens: number };
            handlers.onUsage?.(d);
            break;
          }
          case 'done': {
            const d = data as { message: AiMessage; usage: { inputTokens: number; outputTokens: number; totalTokens: number } };
            doneMessage = d.message;
            doneUsage = d.usage;
            handlers.onDone?.(d);
            break;
          }
          case 'aborted':
            handlers.onAborted?.((data as { reason: string }).reason);
            break;
          case 'proposal': {
            const d = data as { proposalId: string; rationale: string; events: unknown[]; errors: string[] | null };
            handlers.onProposal?.(d);
            break;
          }
          case 'titled': {
            const d = data as { conversationId: string; title: string | null };
            handlers.onTitled?.(d);
            break;
          }
          case 'error': {
            const d = data as { code: string; message: string };
            handlers.onError?.(d);
            throw new Error(d.message || d.code || 'AI 调用失败');
          }
          default:
            break;
        }
      }
    }

    if (!doneMessage || !doneUsage) {
      throw new Error('流结束但未收到 done 事件');
    }
    return { message: doneMessage, usage: doneUsage };
  })();

  return { abort: () => controller.abort(), promise };
}

function parseSseEvent(raw: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  const dataText = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}

export async function listAiProposals(
  project: string,
  conversationId: string
): Promise<{ ok: true; proposals: AiProposal[] }> {
  return fetchJson(
    `/ai/conversations/${encodeURIComponent(
      conversationId
    )}/proposals?project=${encodeURIComponent(project)}`
  );
}

export async function applyAiProposal(
  project: string,
  proposalId: string
): Promise<{ ok: true; applied: number; proposalId: string; items: number; updatedAt: string }> {
  return fetchJson(
    `/ai/proposals/${encodeURIComponent(proposalId)}/apply?project=${encodeURIComponent(project)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
  );
}

export async function renameAiConversation(
  project: string,
  conversationId: string,
  title: string
): Promise<{ ok: true; conversation: AiConversation }> {
  return fetchJson(
    `/ai/conversations/${encodeURIComponent(
      conversationId
    )}?project=${encodeURIComponent(project)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    }
  );
}

export async function deleteAiConversation(
  project: string,
  conversationId: string
): Promise<{ ok: true; messages: number; proposals: number; conversations: number }> {
  return fetchJson(
    `/ai/conversations/${encodeURIComponent(
      conversationId
    )}?project=${encodeURIComponent(project)}`,
    { method: 'DELETE' }
  );
}
