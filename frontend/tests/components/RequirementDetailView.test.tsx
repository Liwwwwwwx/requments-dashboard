import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementDetailView } from '@/components/RequirementDetailView';
import { updateRequirement } from '@/lib/api';
import type { Requirement } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock('@/lib/api', () => ({
  updateRequirement: vi.fn()
}));

const requirement: Requirement = {
  id: 'REQ-0001',
  feature: 'auth',
  title: '登录页',
  type: 'feature',
  status: 'todo',
  workflowStatus: 'open',
  week: '2026-W28',
  owner: 'pm',
  priority: 'P1',
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
  notes: [],
  tasks: [],
  taskStats: { total: 0, done: 0, active: 0, blocked: 0 },
  contract: { ready: false, endpoints: [] }
};

describe('RequirementDetailView', () => {
  beforeEach(() => {
    vi.mocked(updateRequirement).mockReset();
  });

  it('保存基础字段和状态后刷新详情', async () => {
    const onUpdated = vi.fn();
    vi.mocked(updateRequirement).mockResolvedValue({
      ok: true,
      project: 'alpha',
      requirement: { ...requirement, title: '登录页 V2', status: 'blocked' },
      appended: 1
    });

    render(
      <RequirementDetailView
        item={requirement}
        project="alpha"
        taskItems={[]}
        onUpdated={onUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑需求' }));

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '登录页 V2' }
    });
    fireEvent.change(screen.getByLabelText('描述'), {
      target: { value: '只保留用户名密码登录' }
    });
    fireEvent.change(screen.getByLabelText('负责人'), {
      target: { value: 'owner-a' }
    });

    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    const blockedOptions = await screen.findAllByText('阻塞');
    fireEvent.click(blockedOptions[blockedOptions.length - 1]);

    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    const p0Options = await screen.findAllByText('P0');
    fireEvent.click(p0Options[p0Options.length - 1]);

    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => {
      expect(updateRequirement).toHaveBeenCalledWith('alpha', 'REQ-0001', {
        title: '登录页 V2',
        description: '只保留用户名密码登录',
        status: 'blocked',
        priority: 'P0',
        owner: 'owner-a'
      });
    });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  });
});
