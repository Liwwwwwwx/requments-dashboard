import { authFetch } from './auth';
import type {
  BoardState,
  DashboardSummary,
  EventInput,
  Project,
  ProjectEventsResponse,
  Requirement,
  RequirementEvent,
  RequirementStatus,
  Priority
} from './types';

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
  const res = await authFetch(`${API_BASE}${path}`, options);
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

export async function listRequirements(
  project: string
): Promise<{ ok: true; project: string; requirements: Requirement[] }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/requirements`);
}

export async function createRequirement(
  project: string,
  input: {
    title: string;
    description?: string;
    priority?: Priority;
    owner?: string;
  }
): Promise<{ ok: true; project: string; requirement: Requirement; event?: EventInput }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/requirements`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateRequirement(
  project: string,
  requirementId: string,
  input: {
    title?: string;
    description?: string;
    summary?: string;
    status?: RequirementStatus;
    priority?: Priority;
    owner?: string;
  }
): Promise<{ ok: true; project: string; requirement: Requirement; appended: number }> {
  return fetchJson(
    `/projects/${encodeURIComponent(project)}/requirements/${encodeURIComponent(requirementId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input)
    }
  );
}

export async function renderState(
  project: string
): Promise<{ ok: true; items: number; updatedAt: string }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/render`, { method: 'POST' });
}

export async function fetchRequirementEvents(
  project: string,
  requirementId: string
): Promise<{ ok: true; events: RequirementEvent[] }> {
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

export async function fetchDashboardSummary(project: string): Promise<DashboardSummary> {
  return fetchJson(`/dashboard/summary?project=${encodeURIComponent(project)}`);
}

export async function fetchProjectEvents(
  project: string,
  params: { limit?: number; offset?: number; kind?: string; requirementId?: string } = {}
): Promise<ProjectEventsResponse> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  if (params.kind) qs.set('kind', params.kind);
  if (params.requirementId) qs.set('requirementId', params.requirementId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return fetchJson(`/projects/${encodeURIComponent(project)}/events${suffix}`);
}

export { ApiError };
