import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  createProject,
  createRequirement,
  fetchState,
  addRequirementNote,
  listProjects,
  listRequirements,
  updateRequirement
} from '@/lib/api';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: true, projects: [{ id: 'default', name: 'default' }] })
    });
    const result = await listProjects();
    expect(result.projects).toEqual([{ id: 'default', name: 'default' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.any(Object));
  });

  it('throws ApiError with code when API returns structured error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () =>
        JSON.stringify({
          ok: false,
          code: 'PROJECT_NOT_FOUND',
          message: '项目不存在：nope'
        })
    });
    await expect(fetchState('nope')).rejects.toBeInstanceOf(ApiError);
    await expect(fetchState('nope')).rejects.toMatchObject({
      message: '项目不存在：nope',
      code: 'PROJECT_NOT_FOUND'
    });
  });

  it('falls back to legacy `error` field for backward compatibility', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: false, error: 'LEGACY_CODE' })
    });
    await expect(fetchState('legacy')).rejects.toMatchObject({
      message: 'LEGACY_CODE'
    });
  });

  it('falls back to HTTP status text when body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => 'boom'
    });
    await expect(fetchState('boom')).rejects.toThrow(/HTTP 500/);
  });

  it('lists requirements through the V2 endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: true, project: 'default', requirements: [] })
    });

    const result = await listRequirements('default');

    expect(result.requirements).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/default/requirements', expect.any(Object));
  });

  it('creates a project through the V2 endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: true, project: { id: 'alpha', name: 'alpha' } })
    });

    const result = await createProject('alpha');

    expect(result.project.id).toBe('alpha');
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ id: 'alpha' })
    }));
  });

  it('creates a requirement through the V2 endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: true, requirement: { id: 'REQ-0001', title: '需求' } })
    });

    await createRequirement('default', {
      title: '需求',
      description: '描述',
      priority: 'P1',
      owner: 'pm'
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/default/requirements', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        title: '需求',
        description: '描述',
        priority: 'P1',
        owner: 'pm'
      })
    }));
  });

  it('updates a requirement through the V2 endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ ok: true, requirement: { id: 'REQ-0001', status: 'blocked' } })
    });

    await updateRequirement('default', 'REQ-0001', { status: 'blocked' });

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/default/requirements/REQ-0001', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'blocked' })
    }));
  });

  it('adds a requirement note through the requirement event endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({
        ok: true,
        requirementId: 'REQ-0001',
        appended: 1,
        events: [{ kind: 'note.add', text: '备注' }],
        requirement: { id: 'REQ-0001', notes: [{ text: '备注' }] }
      })
    });

    const result = await addRequirementNote('default', 'REQ-0001', '备注');

    expect(result.appended).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/default/requirements/REQ-0001/events', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ kind: 'note.add', text: '备注' })
    }));
  });
});
