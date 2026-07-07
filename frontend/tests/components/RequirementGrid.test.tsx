import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementGrid } from '@/components/RequirementGrid';
import { createRequirement } from '@/lib/api';
import type { BoardState, Filters, Requirement } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock('@/lib/api', () => ({
  createRequirement: vi.fn()
}));

function makeRequirement(
  input: Pick<Requirement, 'id' | 'title' | 'status' | 'priority' | 'owner'> &
    Partial<Pick<Requirement, 'summary'>>
): Requirement {
  return {
    ...input,
    feature: 'core',
    type: 'feature',
    week: '2026-W28',
    updatedAt: '2026-07-07',
    summary: input.summary || '',
    detail: { scope: [], nonGoals: [] },
    acceptance: [],
    links: [],
    sources: [],
    notes: []
  };
}

const data: BoardState = {
  updatedAt: '2026-07-07',
  statuses: [],
  items: [
    makeRequirement({
      id: 'REQ-0001',
      title: '登录',
      status: 'todo',
      priority: 'P0',
      owner: 'pm',
      summary: '最小登录体验'
    }),
    makeRequirement({
      id: 'REQ-0002',
      title: 'AI 小助手',
      status: 'doing',
      priority: 'P2',
      owner: 'dev'
    }),
    makeRequirement({
      id: 'REQ-0003',
      title: '项目列表',
      status: 'blocked',
      priority: 'P1',
      owner: 'pm'
    })
  ]
};

const initialFilters: Filters = {
  query: '',
  status: 'all',
  priority: 'all',
  owner: 'all'
};

function GridHarness() {
  const [filters, setFilters] = useState(initialFilters);
  return (
    <RequirementGrid
      data={data}
      project="alpha"
      filters={filters}
      onFiltersChange={setFilters}
      selectedId={null}
    />
  );
}

function EmptyGridHarness() {
  const [filters, setFilters] = useState(initialFilters);
  return (
    <RequirementGrid
      data={{ updatedAt: '', statuses: [], items: [] }}
      project="alpha"
      filters={filters}
      onFiltersChange={setFilters}
      selectedId={null}
    />
  );
}

describe('RequirementGrid', () => {
  beforeEach(() => {
    vi.mocked(createRequirement).mockReset();
  });

  it('按状态、优先级和负责人筛选需求', () => {
    render(<GridHarness />);

    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('最小登录体验')).toBeInTheDocument();
    expect(screen.getByText('AI 小助手')).toBeInTheDocument();
    expect(screen.getByText('项目列表')).toBeInTheDocument();
    const loginCard = screen.getByText('登录').closest('article');
    expect(loginCard).toBeTruthy();
    expect(within(loginCard as HTMLElement).getByText('pm')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'P0' } });
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.queryByText('AI 小助手')).not.toBeInTheDocument();
    expect(screen.queryByText('项目列表')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('负责人'), { target: { value: 'pm' } });
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('项目列表')).toBeInTheDocument();
    expect(screen.queryByText('AI 小助手')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'blocked' } });
    expect(screen.queryByText('登录')).not.toBeInTheDocument();
    expect(screen.getByText('项目列表')).toBeInTheDocument();
  });

  it('新建需求时提交状态、优先级和负责人', async () => {
    vi.mocked(createRequirement).mockResolvedValue({
      ok: true,
      project: 'alpha',
      requirement: makeRequirement({
        id: 'REQ-0004',
        title: '需求详情',
        status: 'blocked',
        priority: 'P0',
        owner: 'pm'
      })
    });

    render(<GridHarness />);

    fireEvent.click(screen.getByRole('button', { name: /新建需求/ }));
    const dialog = screen.getByRole('dialog', { name: '新建需求' });

    fireEvent.change(within(dialog).getByLabelText('标题'), {
      target: { value: '需求详情' }
    });
    fireEvent.change(within(dialog).getByLabelText('描述'), {
      target: { value: '编辑基础字段和备注' }
    });
    fireEvent.change(within(dialog).getByLabelText('负责人'), {
      target: { value: 'pm' }
    });

    fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[0]);
    const blockedOptions = await screen.findAllByText('阻塞');
    fireEvent.click(blockedOptions[blockedOptions.length - 1]);

    fireEvent.mouseDown(within(dialog).getAllByRole('combobox')[1]);
    const p0Options = await screen.findAllByText('P0');
    fireEvent.click(p0Options[p0Options.length - 1]);

    fireEvent.click(within(dialog).getByRole('button', { name: /创\s*建/ }));

    await waitFor(() => {
      expect(createRequirement).toHaveBeenCalledWith('alpha', {
        title: '需求详情',
        description: '编辑基础字段和备注',
        status: 'blocked',
        priority: 'P0',
        owner: 'pm'
      });
    });
  });

  it('项目没有需求时展示创建第一条需求引导', () => {
    render(<EmptyGridHarness />);

    expect(screen.getByRole('heading', { name: '这个项目还没有需求' })).toBeInTheDocument();
    expect(screen.getByText(/详情页维护状态、备注、变更历史/)).toBeInTheDocument();

    const emptyState = screen.getByText('这个项目还没有需求').closest('.requirements-empty');
    expect(emptyState).toBeTruthy();
    fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: /新建需求/ }));

    expect(screen.getByRole('dialog', { name: '新建需求' })).toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toBeInTheDocument();
  });
});
