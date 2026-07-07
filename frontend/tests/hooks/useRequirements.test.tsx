import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRequirements } from '@/hooks/useRequirements';
import { ApiError, listProjects, listRequirements } from '@/lib/api';
import type { Requirement } from '@/lib/types';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    listProjects: vi.fn(),
    listRequirements: vi.fn()
  };
});

function requirement(input: Partial<Requirement> & Pick<Requirement, 'id' | 'title'>): Requirement {
  return {
    id: input.id,
    feature: 'core',
    title: input.title,
    type: 'feature',
    status: input.status || 'todo',
    week: '2026-W28',
    owner: input.owner || 'pm',
    priority: input.priority || 'P1',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt || '',
    summary: input.summary || '',
    detail: { scope: [], nonGoals: [] },
    acceptance: [],
    links: [],
    sources: [],
    notes: []
  };
}

describe('useRequirements', () => {
  beforeEach(() => {
    vi.mocked(listProjects).mockReset();
    vi.mocked(listProjects).mockResolvedValue({ ok: true, projects: [] });
    vi.mocked(listRequirements).mockReset();
    vi.mocked(listRequirements).mockResolvedValue({ ok: true, project: 'alpha', requirements: [] });
  });

  it('通过 V2 requirements 接口加载看板数据', async () => {
    vi.mocked(listRequirements).mockResolvedValue({
      ok: true,
      project: 'alpha',
      requirements: [
        requirement({ id: 'REQ-0001', title: '登录', status: 'todo', updatedAt: '2026-07-06' }),
        requirement({ id: 'REQ-0002', title: 'AI 小助手', status: 'doing', updatedAt: '2026-07-07' })
      ]
    });

    const { result } = renderHook(() => useRequirements({ project: 'alpha' }));

    await waitFor(() => {
      expect(result.current.data.items).toHaveLength(2);
    });
    expect(listRequirements).toHaveBeenCalledWith('alpha');
    expect(result.current.data.updatedAt).toBe('2026-07-07');
    expect(result.current.data.statuses.map((status) => status.key)).toEqual([
      'todo',
      'doing',
      'blocked',
      'done'
    ]);
  });

  it('项目不存在时清空看板数据', async () => {
    vi.mocked(listRequirements).mockRejectedValue(
      new ApiError('项目不存在：missing', 'PROJECT_NOT_FOUND')
    );

    const { result } = renderHook(() => useRequirements({ project: 'missing' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.data.items).toEqual([]);
  });
});
