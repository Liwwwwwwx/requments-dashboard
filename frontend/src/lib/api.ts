import { authFetch } from './auth';
import type {
  EventInput,
  Project,
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

export async function createProject(
  id: string,
  input: { name?: string; description?: string } = {}
): Promise<{ ok: true; project: Project }> {
  return fetchJson('/projects', {
    method: 'POST',
    body: JSON.stringify({ id, ...input })
  });
}

export async function fetchProject(project: string): Promise<{ ok: true; project: Project }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}`);
}

export async function updateProject(
  project: string,
  input: { name?: string; description?: string }
): Promise<{ ok: true; project: Project }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export async function listRequirements(
  project: string
): Promise<{ ok: true; project: string; requirements: Requirement[] }> {
  return fetchJson(`/projects/${encodeURIComponent(project)}/requirements`);
}

export async function fetchRequirement(
  project: string,
  requirementId: string
): Promise<{ ok: true; project: string; requirement: Requirement }> {
  return fetchJson(
    `/projects/${encodeURIComponent(project)}/requirements/${encodeURIComponent(requirementId)}`
  );
}

export async function createRequirement(
  project: string,
  input: {
    title: string;
    description?: string;
    status?: RequirementStatus;
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
    next?: string;
    acceptance?: string[];
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

export async function fetchRequirementEvents(
  project: string,
  requirementId: string
): Promise<{ ok: true; events: RequirementEvent[] }> {
  return fetchJson(
    `/projects/${encodeURIComponent(project)}/requirements/${encodeURIComponent(requirementId)}/events`
  );
}

export async function addRequirementNote(
  project: string,
  requirementId: string,
  text: string
): Promise<{
  ok: true;
  project: string;
  requirementId: string;
  appended: number;
  events: EventInput[];
  requirement: Requirement;
}> {
  return fetchJson(
    `/projects/${encodeURIComponent(project)}/requirements/${encodeURIComponent(requirementId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify({ kind: 'note.add', text })
    }
  );
}

export { ApiError };
