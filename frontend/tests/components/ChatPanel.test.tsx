import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ChatPanel } from '@/components/ai/ChatPanel';
import {
  createAiConversation,
  getAiConversation,
  listAiConversations,
  sendAiMessageStream
} from '@/lib/ai-api';
import type { AiConversation, AiMessage } from '@/lib/ai-types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn()
  })
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  const Input = Object.assign(actual.Input, {
    TextArea: ({
      className,
      disabled,
      onChange,
      onPressEnter,
      placeholder,
      value
    }: {
      className?: string;
      disabled?: boolean;
      onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
      onPressEnter?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
      placeholder?: string;
      value?: string;
    }) => (
      <textarea
        className={className}
        disabled={disabled}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onPressEnter?.(event);
        }}
        placeholder={placeholder}
        value={value}
      />
    )
  });
  return { ...actual, Input };
});

vi.mock('@/lib/ai-api', () => ({
  listAiConversations: vi.fn(),
  getAiConversation: vi.fn(),
  createAiConversation: vi.fn(),
  sendAiMessageStream: vi.fn()
}));

vi.mock('@/components/ai/ConversationList', () => ({
  ConversationList: () => <aside>会话列表</aside>
}));

vi.mock('@/components/ai/MessageItem', () => ({
  MessageItem: (props: { error?: { code: string; message: string } | null }) => (
    <div>
      消息
      {props.error && <span>{`${props.error.code}:${props.error.message}`}</span>}
    </div>
  )
}));

function conversation(input: Partial<AiConversation>): AiConversation {
  return {
    id: input.id || 'conv-1',
    userId: 'u1',
    projectId: 'alpha',
    requirementId: input.requirementId ?? null,
    title: input.title || null,
    model: 'deepseek-chat',
    accountId: null,
    createdAt: 1000,
    updatedAt: 2000
  };
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.mocked(listAiConversations).mockReset();
    vi.mocked(getAiConversation).mockReset();
    vi.mocked(createAiConversation).mockReset();
    vi.mocked(sendAiMessageStream).mockReset();
    vi.mocked(getAiConversation).mockResolvedValue({
      ok: true,
      conversation: conversation({ id: 'matched', requirementId: 'REQ-0001' }),
      messages: []
    });
  });

  it('需求级入口不会自动选中不匹配的项目级历史会话', async () => {
    vi.mocked(listAiConversations).mockResolvedValue({
      ok: true,
      conversations: [
        conversation({ id: 'project-old', requirementId: null, title: '项目会话' })
      ]
    });

    render(<ChatPanel project="alpha" requirementId="REQ-0001" />);

    await waitFor(() => {
      expect(listAiConversations).toHaveBeenCalledWith('alpha');
    });
    expect(await screen.findByText('已自动绑定到 REQ-0001')).toBeInTheDocument();
    expect(getAiConversation).not.toHaveBeenCalled();
  });

  it('需求级入口优先选中同一需求的历史会话', async () => {
    vi.mocked(listAiConversations).mockResolvedValue({
      ok: true,
      conversations: [
        conversation({ id: 'project-old', requirementId: null, title: '项目会话' }),
        conversation({ id: 'matched', requirementId: 'REQ-0001', title: '需求会话' })
      ]
    });

    render(<ChatPanel project="alpha" requirementId="REQ-0001" />);

    await waitFor(() => {
      expect(getAiConversation).toHaveBeenCalledWith('alpha', 'matched');
    });
  });

  it('快捷提示只围绕项目和需求建议', async () => {
    vi.mocked(listAiConversations).mockResolvedValue({
      ok: true,
      conversations: []
    });

    render(<ChatPanel project="alpha" requirementId="REQ-0001" />);

    expect(await screen.findByRole('button', { name: '总结项目' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拆下一步' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '需求草稿' })).toBeInTheDocument();
    expect(screen.getByText('建议变更')).toBeInTheDocument();
    expect(screen.queryByText('工具')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '推进 FE-1' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '拆下一步' }));
    expect(screen.getByRole('textbox')).toHaveValue(
      '请基于当前项目或需求上下文，给出下一步推进建议，不要直接修改数据。'
    );
  });

  it('发送消息时使用后端账号且不传前端 API Key', async () => {
    vi.mocked(listAiConversations).mockResolvedValue({
      ok: true,
      conversations: []
    });
    vi.mocked(createAiConversation).mockResolvedValue({
      ok: true,
      conversation: conversation({ id: 'conv-new', requirementId: null })
    });
    const assistantMessage: AiMessage = {
      id: 'msg-a',
      conversationId: 'conv-new',
      role: 'assistant',
      content: '收到',
      tokensIn: 1,
      tokensOut: 1,
      ts: 1000
    };
    vi.mocked(sendAiMessageStream).mockReturnValue({
      abort: vi.fn(),
      promise: Promise.resolve({
        message: assistantMessage,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      })
    });

    render(<ChatPanel project="alpha" />);

    await waitFor(() => {
      expect(listAiConversations).toHaveBeenCalledWith('alpha');
    });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '总结一下' }
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => {
      expect(sendAiMessageStream).toHaveBeenCalled();
    });
    expect(sendAiMessageStream).toHaveBeenCalledWith(
      'alpha',
      'conv-new',
      {
        text: '总结一下',
        model: 'deepseek-chat',
        toolsEnabled: true
      },
      expect.any(Object)
    );
  });

  it('保留流式错误的后端 code', async () => {
    vi.mocked(listAiConversations).mockResolvedValue({
      ok: true,
      conversations: []
    });
    vi.mocked(createAiConversation).mockResolvedValue({
      ok: true,
      conversation: conversation({ id: 'conv-new', requirementId: null })
    });
    vi.mocked(sendAiMessageStream).mockImplementation(
      (_project, conversationId, _body, handlers) => ({
        abort: vi.fn(),
        promise: new Promise((_, reject) => {
          setTimeout(() => {
            handlers.onStart?.({
              messageId: 'msg-a',
              conversationId,
              model: 'deepseek-chat'
            });
            handlers.onError?.({
              code: 'AI_PROPOSAL_INVALID',
              message: '模型返回的建议事件不符合 V2 写入范围'
            });
            reject(new Error('模型返回的建议事件不符合 V2 写入范围'));
          }, 0);
        })
      })
    );

    render(<ChatPanel project="alpha" />);

    await waitFor(() => {
      expect(listAiConversations).toHaveBeenCalledWith('alpha');
    });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '创建旧版任务' }
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => {
      expect(sendAiMessageStream).toHaveBeenCalled();
    });
    expect(await screen.findByText(/AI_PROPOSAL_INVALID:/)).toBeInTheDocument();
    expect(screen.queryByText(/AI_NETWORK_ERROR:/)).not.toBeInTheDocument();
  });
});
