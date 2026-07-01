'use client';

import { useState } from 'react';
import { Button, Space, Tooltip, message as antdMessage } from 'antd';
import {
  CheckOutlined,
  CopyOutlined,
  DislikeOutlined,
  LikeOutlined,
  RedoOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { MarkdownLazy } from './MarkdownLazy';
import { ProposalCard } from './ProposalCard';
import type { AiMessage, AiProposal } from '@/lib/ai-types';

interface Props {
  project: string;
  message: AiMessage;
  /** 当前是否正在流式生成（用于显示 ▌ 光标） */
  streaming?: boolean;
  /** 该消息关联的提案 */
  relatedProposals: AiProposal[];
  /** 用户消息被点击时回调（用于后续"用户消息可编辑重发"，暂未启用） */
  onUserMessageClick?: (m: AiMessage) => void;
  /** 重新生成（用上一条 user 消息重新调） */
  onRegenerate?: () => void;
  /** 反馈：👍 / 👎（仅占位，实际未持久化） */
  onFeedback?: (m: AiMessage, value: 'up' | 'down') => void;
  /** 提案应用后回调（router.refresh） */
  onProposalApplied?: () => void;
  /** 流式错误信息（用于在 AI 消息下方显示重试） */
  error?: { code: string; message: string } | null;
  /** 重试回调 */
  onRetry?: () => void;
}

/**
 * 单条消息的渲染单元。
 *
 * 结构：左 avatar + 右 message 气泡（用户/AI 不同布局）
 *   - AI 消息：无背景 prose 排版 + hover 操作行（复制 / 重新生成 / 反馈）
 *   - 用户消息：右对齐 + 浅色背景
 *   - 流式末尾显示 ▌ 闪烁光标
 */
export function MessageItem({
  project,
  message,
  streaming,
  relatedProposals,
  onUserMessageClick,
  onRegenerate,
  onFeedback,
  onProposalApplied,
  error,
  onRetry
}: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      antdMessage.success('已复制');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      antdMessage.error('复制失败');
    }
  };

  const handleFeedback = (value: 'up' | 'down') => {
    setFeedback(value);
    onFeedback?.(message, value);
  };

  return (
    <div className={`msg-row ${isUser ? 'is-user' : 'is-assistant'}`}>
      {!isUser && (
        <div className="msg-avatar">
          <RobotOutlined />
        </div>
      )}
      <div className="msg-body">
        {!isUser && (
          <div className="msg-header">
            <span className="msg-author">DeepSeek</span>
            {message.id.startsWith('local-') && (
              <span className="msg-status">发送中…</span>
            )}
          </div>
        )}

        {isUser ? (
          <div
            className="msg-bubble-user"
            onClick={onUserMessageClick ? () => onUserMessageClick(message) : undefined}
            role={onUserMessageClick ? 'button' : undefined}
          >
            <MarkdownLazy content={message.content} />
          </div>
        ) : (
          <article className="msg-prose">
            {message.content ? <MarkdownLazy content={message.content} /> : '(空)'}
            {streaming && <span className="msg-cursor" aria-hidden>▌</span>}
          </article>
        )}

        {/* tokens 用量（仅 AI） */}
        {!isUser && (message.tokensIn > 0 || message.tokensOut > 0) && (
          <div className="msg-tokens">
            tokens · in {message.tokensIn} / out {message.tokensOut}
          </div>
        )}

        {/* 失败行内错误 + 重试 */}
        {!isUser && error && (
          <div className="msg-error">
            <span className="msg-error-text">
              {error.code}: {error.message}
            </span>
            {onRetry && (
              <Button size="small" type="link" onClick={onRetry} icon={<RedoOutlined />}>
                重试
              </Button>
            )}
          </div>
        )}

        {/* 提案卡片（紧跟在 AI 消息后） */}
        {!isUser && relatedProposals.map((p) => (
          <ProposalCard
            key={p.id}
            project={project}
            proposal={p}
            onApplied={onProposalApplied}
          />
        ))}

        {/* AI 消息 hover 操作行 */}
        {!isUser && !streaming && !error && (
          <div className="msg-actions">
            <Space size="small">
              <Tooltip title={copied ? '已复制' : '复制'}>
                <Button
                  size="small"
                  type="text"
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={handleCopy}
                />
              </Tooltip>
              {onRegenerate && (
                <Tooltip title="重新生成">
                  <Button
                    size="small"
                    type="text"
                    icon={<RedoOutlined />}
                    onClick={onRegenerate}
                  />
                </Tooltip>
              )}
              <Tooltip title="有用">
                <Button
                  size="small"
                  type="text"
                  icon={<LikeOutlined />}
                  onClick={() => handleFeedback('up')}
                  className={feedback === 'up' ? 'is-active' : ''}
                />
              </Tooltip>
              <Tooltip title="没用">
                <Button
                  size="small"
                  type="text"
                  icon={<DislikeOutlined />}
                  onClick={() => handleFeedback('down')}
                  className={feedback === 'down' ? 'is-active' : ''}
                />
              </Tooltip>
            </Space>
          </div>
        )}
      </div>
    </div>
  );
}