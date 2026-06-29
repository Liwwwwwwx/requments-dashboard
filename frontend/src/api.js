const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchJson(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
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
