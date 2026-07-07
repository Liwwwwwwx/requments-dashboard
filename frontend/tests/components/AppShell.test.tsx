import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/AppShell';
import { useRequirements } from '@/hooks/useRequirements';
import { fetchRequirement } from '@/lib/api';
import type { Requirement } from '@/lib/types';

const detailViewMock = vi.hoisted(() =>
  vi.fn((props: { item: Requirement | null; project: string }) => (
    <div data-testid="requirement-detail" data-project={props.project}>
      {props.item ? props.item.title : '请选择一条需求'}
    </div>
  ))
);

vi.mock('next/navigation', () => ({
  useParams: () => ({ project: 'default' }),
  usePathname: () => '/p/default',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock('@/hooks/useRequirements', () => ({
  useRequirements: vi.fn()
}));

vi.mock('@/lib/api', () => ({
  createProject: vi.fn(),
  fetchRequirement: vi.fn()
}));

vi.mock('@/components/RequirementDetailView', () => ({
  RequirementDetailView: detailViewMock
}));

describe('AppShell', () => {
  beforeEach(() => {
    detailViewMock.mockClear();
    vi.mocked(fetchRequirement).mockReset();
  });

  it('首次无项目时展示创建项目空状态', () => {
    vi.mocked(useRequirements).mockReturnValue({
      project: 'default',
      projects: [],
      data: { updatedAt: '', statuses: [], items: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      loadState: vi.fn(),
      loadProjects: vi.fn()
    });

    render(<AppShell project="default" />);

    expect(screen.getByRole('heading', { name: '还没有项目' })).toBeInTheDocument();
    expect(screen.getByText(/需求看板、需求详情和 AI 小助手/)).toBeInTheDocument();

    const emptyState = screen.getByText('还没有项目').closest('.first-project-empty');
    expect(emptyState).toBeTruthy();
    fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: '创建项目' }));

    expect(screen.getByRole('dialog', { name: '创建项目' })).toBeInTheDocument();
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument();
  });

  it('无项目时优先展示创建项目空状态而不是子页面', () => {
    vi.mocked(useRequirements).mockReturnValue({
      project: 'default',
      projects: [],
      data: { updatedAt: '', statuses: [], items: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      loadState: vi.fn(),
      loadProjects: vi.fn()
    });

    render(
      <AppShell project="default">
        <div>AI 子页面</div>
      </AppShell>
    );

    expect(screen.getByRole('heading', { name: '还没有项目' })).toBeInTheDocument();
    expect(screen.queryByText('AI 子页面')).not.toBeInTheDocument();
  });

  it('详情深链在列表缺失时兜底加载当前需求', async () => {
    const requirement: Requirement = {
      id: 'REQ-0001',
      title: '登录页',
      type: 'feature',
      status: 'todo',
      week: '2026-W28',
      owner: 'pm',
      priority: 'P1',
      createdAt: '2026-07-06',
      updatedAt: '2026-07-07',
      summary: '补齐最简单的登录体验',
      detail: {
        goal: '用户可以登录系统',
        scope: [],
        nonGoals: []
      },
      acceptance: [],
      links: [],
      sources: [],
      notes: []
    };
    vi.mocked(fetchRequirement).mockResolvedValue({
      ok: true,
      project: 'alpha',
      requirement
    });
    vi.mocked(useRequirements).mockReturnValue({
      project: 'alpha',
      projects: [{ id: 'alpha', name: 'Alpha' }],
      data: { updatedAt: '', statuses: [], items: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      loadState: vi.fn(),
      loadProjects: vi.fn()
    });

    render(<AppShell project="alpha" reqId="REQ-0001" />);

    await waitFor(() => {
      expect(fetchRequirement).toHaveBeenCalledWith('alpha', 'REQ-0001');
    });
    const detail = screen.getByTestId('requirement-detail');
    expect(within(detail).getByText('登录页')).toBeInTheDocument();
    expect(detail).toHaveAttribute('data-project', 'alpha');
  });

  it('项目列表刷新信号变化后重新加载项目列表', async () => {
    const loadProjects = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useRequirements).mockReturnValue({
      project: 'alpha',
      projects: [{ id: 'alpha', name: 'Alpha' }],
      data: { updatedAt: '', statuses: [], items: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      loadState: vi.fn(),
      loadProjects
    });

    const { rerender } = render(
      <AppShell project="alpha" projectListRefreshKey={0}>
        <div>设置页</div>
      </AppShell>
    );

    expect(loadProjects).not.toHaveBeenCalled();

    rerender(
      <AppShell project="alpha" projectListRefreshKey={1}>
        <div>设置页</div>
      </AppShell>
    );

    await waitFor(() => {
      expect(loadProjects).toHaveBeenCalledTimes(1);
    });
  });

  it('顶栏展示当前项目名称', () => {
    vi.mocked(useRequirements).mockReturnValue({
      project: 'alpha',
      projects: [{ id: 'alpha', name: 'Alpha 项目' }],
      data: { updatedAt: '', statuses: [], items: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      loadState: vi.fn(),
      loadProjects: vi.fn()
    });

    render(<AppShell project="alpha" />);

    const projectScope = screen.getByLabelText('当前项目');
    expect(within(projectScope).getByText('Alpha 项目')).toBeInTheDocument();
  });
});
