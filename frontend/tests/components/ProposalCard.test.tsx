import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProposalCard } from '@/components/ai/ProposalCard';
import type { AiProposal } from '@/lib/ai-types';

vi.mock('@/lib/ai-api', () => ({
  applyAiProposal: vi.fn()
}));

function proposal(events: AiProposal['events']): AiProposal {
  return {
    id: 'proposal-1',
    conversationId: 'conv-1',
    messageId: 'msg-1',
    events,
    status: 'pending',
    createdAt: 1000
  };
}

describe('ProposalCard', () => {
  it('只为 V2 允许的提案事件展示产品化标签', () => {
    render(
      <ProposalCard
        project="alpha"
        proposal={proposal([
          { kind: 'req.status', requirementId: 'REQ-1', status: 'doing' },
          { kind: 'req.patch', requirementId: 'REQ-1', title: '登录页' },
          { kind: 'note.add', requirementId: 'REQ-1', text: '补充验收口径' },
          { kind: 'task.new', requirementId: 'REQ-1', taskId: 'FE-1' }
        ])}
      />
    );

    expect(screen.getByText('改需求状态')).toBeInTheDocument();
    expect(screen.getByText('改需求字段')).toBeInTheDocument();
    expect(screen.getByText('添加备注')).toBeInTheDocument();
    expect(screen.getByText('不支持的事件')).toBeInTheDocument();
    expect(screen.getByText(/task\.new/)).toBeInTheDocument();
    expect(screen.getByText('含不支持事件')).toBeInTheDocument();
    expect(screen.getByText(/请重新生成提案/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /应用到看板/ })).toBeDisabled();
    expect(screen.queryByText('新建任务')).not.toBeInTheDocument();
  });
});
