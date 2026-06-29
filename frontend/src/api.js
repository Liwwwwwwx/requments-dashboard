const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchJson(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch (_err) {
      body = null;
    }
    if (body?.error) {
      throw new Error(body.error);
    }
    const clean = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.includes('Cannot POST /api/ai-usage') || clean.includes('Cannot GET /api/ai-usage')) {
      throw new Error('AI 用量后端接口不存在：请停止旧服务，并在当前 worktree 重新执行 npm run dev');
    }
    throw new Error(`HTTP ${res.status}: ${clean || res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function listProjects() {
  return fetchJson('/projects');
}

export async function fetchState(project) {
  return fetchJson(`/projects/${encodeURIComponent(project)}/state`);
}

export async function renderState(project) {
  return fetchJson(`/projects/${encodeURIComponent(project)}/render`, { method: 'POST' });
}

export async function fetchRequirementEvents(project, requirementId) {
  return fetchJson(`/projects/${encodeURIComponent(project)}/requirements/${encodeURIComponent(requirementId)}/events`);
}

export async function appendEvents(project, events) {
  return fetchJson(`/projects/${encodeURIComponent(project)}/events`, {
    method: 'POST',
    body: JSON.stringify({ events })
  });
}

export async function fetchAiUsageState() {
  return fetchJson('/ai-usage/state');
}

export async function saveAiUsageAccount(account) {
  return fetchJson('/ai-usage/accounts', {
    method: 'POST',
    body: JSON.stringify(account)
  });
}

export async function testAiUsageConnection(config) {
  return fetchJson('/ai-usage/test', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export async function appendAiUsageSnapshot(snapshot) {
  return fetchJson('/ai-usage/snapshots', {
    method: 'POST',
    body: JSON.stringify(snapshot)
  });
}

export async function syncAiUsageAccount(accountId) {
  return fetchJson(`/ai-usage/accounts/${encodeURIComponent(accountId)}/sync`, {
    method: 'POST'
  });
}
