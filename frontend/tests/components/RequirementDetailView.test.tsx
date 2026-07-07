import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementDetailView } from '@/components/RequirementDetailView';
import { addRequirementNote, fetchRequirementEvents, updateRequirement } from '@/lib/api';
import type { Requirement } from '@/lib/types';

const routerPush = vi.fn();
const chatPanelMock = vi.hoisted(() =>
  vi.fn(
    (props: {
      project: string;
      requirementId?: string;
      compact?: boolean;
      onProposalApplied?: () => void;
    }) => (
      <div
        data-testid="detail-ai-panel"
        data-project={props.project}
        data-requirement={props.requirementId}
        data-compact={String(props.compact)}
      >
        AI Mock
      </div>
    )
  )
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush
  })
}));

vi.mock('@/components/ai/ChatPanel', () => ({
  ChatPanel: chatPanelMock
}));

vi.mock('@/lib/api', () => ({
  addRequirementNote: vi.fn(),
  fetchRequirementEvents: vi.fn(),
  updateRequirement: vi.fn()
}));

const requirement: Requirement = {
  id: 'REQ-0001',
  feature: 'auth',
  title: '登录页',
  type: 'feature',
  status: 'todo',
  week: '2026-W28',
  owner: 'pm',
  priority: 'P1',
  createdBy: 'test-admin',
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

describe('RequirementDetailView', () => {
  beforeEach(() => {
    vi.mocked(fetchRequirementEvents).mockReset();
    vi.mocked(fetchRequirementEvents).mockResolvedValue({ ok: true, events: [] });
    vi.mocked(addRequirementNote).mockReset();
    vi.mocked(updateRequirement).mockReset();
    routerPush.mockReset();
    chatPanelMock.mockClear();
  });

  it('在详情页展示绑定当前需求的 AI 小助手', async () => {
    render(
      <RequirementDetailView
        item={requirement}
        project="alpha"
      />
    );

    await waitFor(() => {
      expect(fetchRequirementEvents).toHaveBeenCalledWith('alpha', 'REQ-0001');
    });

    const aiPanel = screen.getByTestId('detail-ai-panel');
    expect(aiPanel).toHaveAttribute('data-project', 'alpha');
    expect(aiPanel).toHaveAttribute('data-requirement', 'REQ-0001');
    expect(aiPanel).toHaveAttribute('data-compact', 'true');
    expect(screen.getByText('创建人')).toBeInTheDocument();
    expect(screen.getByText('test-admin')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '完整 AI' }));

    expect(routerPush).toHaveBeenCalledWith('/p/alpha/ai?requirementId=REQ-0001');
  });

  it('加载并展示需求变更历史', async () => {
    vi.mocked(fetchRequirementEvents).mockResolvedValue({
      ok: true,
      events: [
        {
          eventId: 'E1',
          ts: 1000,
          kind: 'req.new',
          actor: 'pm',
          event: { title: '登录页' }
        },
        {
          eventId: 'E2',
          ts: 2000,
          kind: 'req.status',
          actor: 'dev',
          event: { status: 'blocked' }
        },
        {
          eventId: 'E3',
          ts: 3000,
          kind: 'req.patch',
          actor: 'pm',
          event: { title: '登录页 V2', summary: '只保留用户名密码登录', priority: 'P0', owner: 'owner-a' }
        },
        {
          eventId: 'E4',
          ts: 4000,
          kind: 'note.add',
          actor: 'pm',
          event: { text: '先保持最小登录' }
        },
        {
          eventId: 'E5',
          ts: 5000,
          kind: 'req.patch',
          actor: 'pm',
          event: {
            detail: {
              next: '确认错误提示文案',
              scope: ['用户名密码登录']
            },
            acceptance: ['登录成功后进入项目页']
          }
        }
      ]
    });

    render(
      <RequirementDetailView
        item={requirement}
        project="alpha"
      />
    );

    await waitFor(() => {
      expect(fetchRequirementEvents).toHaveBeenCalledWith('alpha', 'REQ-0001');
    });
    expect(await screen.findByText('变更历史')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('2026-07-06')).toBeInTheDocument();
    expect(screen.getByText('新建需求')).toBeInTheDocument();
    expect(screen.getByText('状态变更 → 阻塞')).toBeInTheDocument();
    expect(screen.getByText('标题：登录页 V2；描述：只保留用户名密码登录；优先级：P0；负责人：owner-a')).toBeInTheDocument();
    expect(screen.getByText('先保持最小登录')).toBeInTheDocument();
    expect(screen.getByText('下一步：确认错误提示文案；范围：用户名密码登录；验收点：登录成功后进入项目页')).toBeInTheDocument();
  });

  it('不展示旧版工作流状态字段', async () => {
    render(
      <RequirementDetailView
        item={requirement}
        project="alpha"
      />
    );

    await waitFor(() => {
      expect(fetchRequirementEvents).toHaveBeenCalledWith('alpha', 'REQ-0001');
    });
    expect(screen.queryByText('工作流')).not.toBeInTheDocument();
    expect(screen.queryByText('open')).not.toBeInTheDocument();
  });

  it('不展示旧版任务列表和任务统计', async () => {
    render(
      <RequirementDetailView
        item={{
          ...requirement,
          tasks: [
            {
              taskId: 'FE-1',
              role: 'frontend',
              title: '实现登录表单',
              status: 'blocked',
              agent: 'agent-a'
            }
          ],
          taskStats: { total: 1, done: 0, active: 0, blocked: 1 }
        }}
        project="alpha"
      />
    );

    await waitFor(() => {
      expect(fetchRequirementEvents).toHaveBeenCalledWith('alpha', 'REQ-0001');
    });
    expect(screen.queryByText('任务统计')).not.toBeInTheDocument();
    expect(screen.queryByText('阻塞任务')).not.toBeInTheDocument();
    expect(screen.queryByText('FE-1')).not.toBeInTheDocument();
    expect(screen.queryByText('实现登录表单')).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText('下一步'), {
      target: { value: '确认登录失败提示' }
    });
    fireEvent.change(screen.getByLabelText('验收点'), {
      target: { value: '登录成功后进入项目页\n密码错误时显示提示' }
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
        owner: 'owner-a',
        next: '确认登录失败提示',
        acceptance: ['登录成功后进入项目页', '密码错误时显示提示']
      });
    });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  });

  it('添加备注后刷新详情和变更历史', async () => {
    const onUpdated = vi.fn();
    vi.mocked(addRequirementNote).mockResolvedValue({
      ok: true,
      project: 'alpha',
      requirementId: 'REQ-0001',
      appended: 1,
      events: [{ kind: 'note.add', requirementId: 'REQ-0001', text: '先保持最小登录' }],
      requirement: {
        ...requirement,
        notes: [{ text: '先保持最小登录', at: '2026-07-07T00:00:00.000Z', agent: null }]
      }
    });

    render(
      <RequirementDetailView
        item={requirement}
        project="alpha"
        onUpdated={onUpdated}
      />
    );

    await waitFor(() => {
      expect(fetchRequirementEvents).toHaveBeenCalledWith('alpha', 'REQ-0001');
    });

    fireEvent.click(screen.getByRole('button', { name: '添加备注' }));
    fireEvent.change(screen.getByLabelText('备注内容'), {
      target: { value: '先保持最小登录' }
    });
    const dialog = screen.getByRole('dialog', { name: '添加备注' });
    fireEvent.click(within(dialog).getByRole('button', { name: /添\s*加/ }));

    await waitFor(() => {
      expect(addRequirementNote).toHaveBeenCalledWith('alpha', 'REQ-0001', '先保持最小登录');
    });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(fetchRequirementEvents).toHaveBeenCalledTimes(2);
  });
});
