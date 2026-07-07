'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Space, Spin, Switch, Tooltip, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  RedoOutlined,
  StopOutlined
} from '@ant-design/icons';
import {
  createAiConversation,
  getAiConversation,
  listAiConversations,
  sendAiMessageStream
} from '@/lib/ai-api';
import type { AiMessage, AiProposal } from '@/lib/ai-types';
import { MessageItem } from './MessageItem';
import { ConversationList } from './ConversationList';

const { TextArea } = Input;
const { Text } = Typography;

const QUICK_PROMPTS = [
  { label: '总结项目', text: '请总结当前项目的需求现状，按状态、优先级和负责人列出重点。' },
  { label: '拆下一步', text: '请基于当前项目或需求上下文，给出下一步推进建议，不要直接修改数据。' },
  { label: '需求草稿', text: '请根据我的描述生成一份需求草稿，包含标题、描述、优先级和验收点。' }
];

const STICK_TO_BOTTOM_THRESHOLD = 80;

interface Props {
  project: string;
  requirementId?: string;
  onProposalApplied?: () => void;
  compact?: boolean;
}

export function ChatPanel({ project, requirementId, onProposalApplied, compact = false }: Props) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [proposals, setProposals] = useState<Record<string, AiProposal>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastError, setLastError] = useState<{ code: string; message: string } | null>(null);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [stickToBottom, setStickToBottom] = useState(true);
  /** 强制触发 ConversationList 重新拉取（用 counter 做依赖） */
  const [convListTick, setConvListTick] = useState(0);

  const streamAbortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastUserTextRef = useRef<string | null>(null);

  // 进入项目/需求时自动选会话：需求级入口只复用同一需求的历史会话。
  useEffect(() => {
    let cancelled = false;
    setConversationId(null);
    setMessages([]);
    setProposals({});
    setLastError(null);
    lastUserTextRef.current = null;
    (async () => {
      try {
        const res = await listAiConversations(project);
        if (cancelled) return;
        const next = requirementId
          ? res.conversations.find((conv) => conv.requirementId === requirementId)
          : res.conversations[0];
        setConversationId(next?.id || null);
      } catch {
        // 静默
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, requirementId]);

  // 加载历史消息
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setProposals({});
      setLastError(null);
      return;
    }
    (async () => {
      try {
        const res = await getAiConversation(project, conversationId);
        setMessages(res.messages);
        setProposals({});
        setLastError(null);
      } catch {
        // 静默
      }
    })();
  }, [project, conversationId]);

  // 智能滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStickToBottom(distance < STICK_TO_BOTTOM_THRESHOLD);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (!stickToBottom) return;
    const id = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, stickToBottom]);

  const handleScrollToBottom = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    setStickToBottom(true);
  };

  const handleStop = useCallback(() => {
    streamAbortRef.current?.();
    streamAbortRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      setLastError(null);
      setSending(true);
      try {
        let cid = conversationId;
        if (!cid) {
          const created = await createAiConversation(project, {
            requirementId,
            model: 'deepseek-chat'
          });
          cid = created.conversation.id;
          setConversationId(cid);
          setConvListTick((t) => t + 1);
        }
        const optimisticUser: AiMessage = {
          id: `local-u-${Date.now()}`,
          conversationId: cid,
          role: 'user',
          content: textToSend,
          tokensIn: 0,
          tokensOut: 0,
          ts: Date.now()
        };
        setMessages((prev) => [...prev, optimisticUser]);

        let assistantPlaceholderId: string | null = null;
        const stream = sendAiMessageStream(
          project,
          cid,
          {
            text: textToSend,
            model: 'deepseek-chat',
            toolsEnabled
          },
          {
            onUser: (msg) => {
              setMessages((prev) => [...prev.filter((m) => m.id !== optimisticUser.id), msg]);
            },
            onStart: ({ messageId }) => {
              assistantPlaceholderId = messageId;
              setMessages((prev) => [
                ...prev,
                {
                  id: messageId,
                  conversationId: cid!,
                  role: 'assistant',
                  content: '',
                  tokensIn: 0,
                  tokensOut: 0,
                  ts: Date.now()
                }
              ]);
              setStickToBottom(true);
            },
            onDelta: (delta) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantPlaceholderId ? { ...m, content: m.content + delta } : m
                )
              );
            },
            onUsage: (usage) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantPlaceholderId
                    ? { ...m, tokensIn: usage.inputTokens, tokensOut: usage.outputTokens }
                    : m
                )
              );
            },
            onProposal: (p) => {
              const proposal: AiProposal = {
                id: p.proposalId,
                conversationId: cid!,
                messageId: assistantPlaceholderId || '',
                events: (p.events as AiProposal['events']) || [],
                status: 'pending',
                createdAt: Date.now()
              };
              setProposals((prev) => ({ ...prev, [p.proposalId]: proposal }));
              if (p.errors && p.errors.length > 0) {
                setLastError({
                  code: 'AI_PROPOSAL_INVALID',
                  message: `建议事件校验失败：${p.errors.join('; ')}`
                });
              }
            },
            onTitled: ({ conversationId: titledId, title }) => {
              // 后端自动生成了会话标题，刷新左侧栏
              if (titledId === cid && title) {
                setConvListTick((t) => t + 1);
              }
            },
            onDone: ({ message }) => {
              setMessages((prev) => [...prev.filter((m) => m.id !== message.id), message]);
              assistantPlaceholderId = null;
            },
            onAborted: (reason) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantPlaceholderId
                    ? { ...m, content: (m.content || '') + (m.content ? '\n' : '') + `[已中断：${reason || '用户取消'}]` }
                    : m
                )
              );
              assistantPlaceholderId = null;
            },
            onError: (err) => {
              setLastError(err);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantPlaceholderId && m.role === 'assistant' && !m.content
                    ? { ...m, content: '' }
                    : m
                )
              );
              assistantPlaceholderId = null;
            }
          }
        );
        streamAbortRef.current = stream.abort;
        await stream.promise;
        setConvListTick((t) => t + 1);
      } catch (e) {
        if (!lastError) {
          setLastError({
            code: 'AI_NETWORK_ERROR',
            message: e instanceof Error ? e.message : '发送失败'
          });
        }
      } finally {
        setSending(false);
        streamAbortRef.current = null;
      }
    },
    [conversationId, project, requirementId, toolsEnabled, lastError]
  );

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setText('');
    lastUserTextRef.current = value;
    await sendMessage(value);
  };

  const handleRetry = async () => {
    if (sending) return;
    const textToRetry = lastUserTextRef.current;
    if (!textToRetry) return;
    setLastError(null);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant' && !last.content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    await sendMessage(textToRetry);
  };

  const handleRegenerate = async () => {
    await handleRetry();
  };

  const handleNewConversation = () => {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setProposals({});
    setLastError(null);
    lastUserTextRef.current = null;
  };

  const handleSelectConversation = (id: string | null) => {
    if (sending || !id) return;
    setConversationId(id);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className={`ai-panel ${compact ? 'ai-panel-compact' : ''}`}>
      {!compact && (
        <ConversationList
          project={project}
          selectedId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDeleted={(id) => {
            // 删的是当前正在看的会话 → 清空主面板
            if (id === conversationId) {
              setConversationId(null);
              setMessages([]);
              setProposals({});
              setLastError(null);
              lastUserTextRef.current = null;
            }
            setConvListTick((t) => t + 1);
          }}
          disabled={sending}
          // 传 key 用作触发 refresh
          key={convListTick}
        />
      )}

      <div className="ai-main">
        <div className="ai-panel-toolbar">
          <Space size={6} align="center">
            <span className="ai-model-dot" />
            <Text className="ai-toolbar-label">deepseek-chat</Text>
          </Space>
        </div>

        <div className="ai-panel-scroll" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="ai-panel-empty">
              <div className="ai-panel-empty-icon">
                <Spin size="large" />
              </div>
              <div className="ai-panel-empty-title">开始与 DeepSeek 对话</div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {requirementId
                  ? `已自动绑定到 ${requirementId}`
                  : '支持自然语言提问、需求摘要、推进建议'}
              </Text>
              <Space wrap style={{ marginTop: 16, justifyContent: 'center' }}>
                {QUICK_PROMPTS.map((p) => (
                  <Button
                    key={p.label}
                    size="small"
                    disabled={sending}
                    onClick={() => {
                      setText(p.text);
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </Space>
            </div>
          ) : (
            <div className="msg-list" role="log" aria-live="polite">
              {messages.map((m) => {
                const relatedProposals = Object.values(proposals).filter(
                  (p) => p.messageId === m.id
                );
                const isLastAssistant = m.id === lastAssistant?.id;
                const msgError =
                  isLastAssistant && lastError && !m.content ? lastError : null;
                return (
                  <MessageItem
                    key={m.id}
                    project={project}
                    message={m}
                    streaming={sending && isLastAssistant}
                    relatedProposals={relatedProposals}
                    error={msgError}
                    onRetry={isLastAssistant ? handleRetry : undefined}
                    onRegenerate={
                      isLastAssistant && !sending && m.role === 'assistant'
                        ? handleRegenerate
                        : undefined
                    }
                    onProposalApplied={() => {
                      setProposals((prev) => ({
                        ...prev,
                        ...Object.fromEntries(
                          Object.entries(prev).map(([k, v]) => [k, { ...v, status: 'applied' as const }])
                        )
                      }));
                      try {
                        router.refresh();
                      } catch {
                        // 路由刷新失败不影响主流程
                      }
                      onProposalApplied?.();
                    }}
                  />
                );
              })}
              {sending && !lastAssistant && (
                <div className="msg-row is-assistant is-thinking">
                  <div className="msg-avatar"><Spin size="small" /></div>
                  <div className="msg-body">
                    <Text type="secondary">思考中…</Text>
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.length > 0 && !stickToBottom && (
            <button
              type="button"
              className="ai-jump-bottom"
              onClick={handleScrollToBottom}
              aria-label="跳到底部"
            >
              <ArrowDownOutlined />
            </button>
          )}
        </div>

        <div className="ai-panel-input">
          <div className={`ai-input-wrap ${text.trim() ? 'has-content' : ''}`}>
            <TextArea
              className="ai-input-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              autoSize={{ minRows: 1, maxRows: 8 }}
              placeholder={
                sending
                  ? '正在生成中…'
                  : '发消息给 DeepSeek'
              }
              disabled={sending}
              variant="borderless"
            />
            <div className="ai-input-toolbar">
              <div className="ai-input-toolbar-left">
                <Tooltip title="开启后 AI 只生成建议事件，用户确认后才会应用到看板；关闭后只回答问题">
                  <Space size={4} align="center" className="ai-input-toolswitch">
                    <Switch
                      size="small"
                      checked={toolsEnabled}
                      onChange={setToolsEnabled}
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>建议变更</Text>
                  </Space>
                </Tooltip>
              </div>
              <div className="ai-input-toolbar-right">
                {sending ? (
                  <Tooltip title="停止生成">
                    <Button
                      type="text"
                      shape="circle"
                      className="ai-input-action stop"
                      icon={<StopOutlined />}
                      onClick={handleStop}
                    />
                  </Tooltip>
                ) : lastError && messages.length > 0 ? (
                  <Tooltip title="重试">
                    <Button
                      type="primary"
                      shape="circle"
                      className="ai-input-action"
                      icon={<RedoOutlined />}
                      disabled={!lastUserTextRef.current}
                      onClick={handleRetry}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title="发送（Enter）">
                    <Button
                      type="primary"
                      shape="circle"
                      className="ai-input-action"
                      icon={<ArrowUpOutlined />}
                      disabled={!text.trim()}
                      onClick={handleSend}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
          <div className="ai-input-hint">
            Enter 发送 · Shift+Enter 换行
          </div>
        </div>
      </div>
    </div>
  );
}
ChatPanel.displayName = 'ChatPanel';
