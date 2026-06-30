import type { AiUsageState, BoardState, EventInput, Project } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
    ...options
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const errBody = body as { message?: string; error?: string; code?: string } | null;
    const message = errBody?.message || errBody?.error || `HTTP ${res.status}`;
    throw new ApiError(message, errBody?.code);
  }
  return body as T;
}

export async function listProjects(): Promise<{ ok: true; projects: Project[] }> {
  return fetchJson('/projects');
}

export async function fetchState(project: string): Promise<BoardState> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/state`);
}

export async function renderState(
  project: string
): Promise<{ ok: true; items: number; updatedAt: string }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/render`, { method: 'POST' });
}

export async function fetchRequirementEvents(
  project: string,
  requirementId: string
): Promise<{ ok: true; events: unknown[] }> {
  return fetchJson(
    `/projects/${encodeURIComponent(project)}/requirements/${encodeURIComponent(requirementId)}/events`
  );
}

export async function appendEvents(
  project: string,
  events: EventInput[]
): Promise<{ ok: true; appended: number; items: number; updatedAt: string }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/events`, {
    method: 'POST',
    body: JSON.stringify({ events })
  });
}

export async function fetchAiUsageState(): Promise<AiUsageState> {
  return fetchJson('/ai-usage/state');
}

export async function saveAiUsageAccount(
  account: Record<string, unknown>
): Promise<{ ok: true; account: unknown; state: AiUsageState }> {
  return fetchJson('/ai-usage/accounts', {
    method: 'POST',
    body: JSON.stringify(account)
  });
}

export async function testAiUsageConnection(
  config: Record<string, unknown>
): Promise<{ ok: true; status: number; models: string[]; modelCount: number }> {
  return fetchJson('/ai-usage/test', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export async function appendAiUsageSnapshot(
  snapshot: Record<string, unknown>
): Promise<{ ok: true; snapshot: unknown; state: AiUsageState }> {
  return fetchJson('/ai-usage/snapshots', {
    method: 'POST',
    body: JSON.stringify(snapshot)
  });
}

export async function syncAiUsageAccount(accountId: string): Promise<{
  ok: true;
  snapshot: unknown;
  syncUrl: string;
  state: AiUsageState;
}> {
  return fetchJson(`/ai-usage/accounts/${encodeURIComponent(accountId)}/sync`, {
    method: 'POST'
  });
}

export { ApiError };