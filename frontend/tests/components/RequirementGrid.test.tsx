import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RequirementGrid } from '@/components/RequirementGrid';
import type { BoardState, Filters, Requirement } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

function makeRequirement(
  input: Pick<Requirement, 'id' | 'title' | 'status' | 'priority' | 'owner'> &
    Partial<Pick<Requirement, 'summary' | 'taskStats'>>
): Requirement {
  return {
    ...input,
    feature: 'core',
    type: 'feature',
    workflowStatus: 'open',
    week: '2026-W28',
    updatedAt: '2026-07-07',
    summary: input.summary || '',
    detail: { scope: [], nonGoals: [] },
    acceptance: [],
    links: [],
    sources: [],
    notes: [],
    tasks: [],
    taskStats: input.taskStats || { total: 0, done: 0, active: 0, blocked: 0 },
    contract: { ready: false, endpoints: [] }
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
      summary: '最小登录体验',
      taskStats: { total: 3, done: 1, active: 1, blocked: 1 }
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
  type: 'all',
  role: 'all',
  status: 'all',
  priority: 'all',
  owner: 'all',
  week: 'all'
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

describe('RequirementGrid', () => {
  it('按状态、优先级和负责人筛选需求', () => {
    render(<GridHarness />);

    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('最小登录体验')).toBeInTheDocument();
    expect(screen.queryByText('阻塞 1')).not.toBeInTheDocument();
    expect(screen.queryByText('进行 1')).not.toBeInTheDocument();
    expect(screen.getByText('AI 小助手')).toBeInTheDocument();
    expect(screen.getByText('项目列表')).toBeInTheDocument();

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
});
