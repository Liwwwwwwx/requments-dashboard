import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, fetchState, listProjects } from '@/lib/api';

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
});