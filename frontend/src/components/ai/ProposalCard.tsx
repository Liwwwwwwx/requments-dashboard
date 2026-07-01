'use client';

import { useState } from 'react';
import { Button, Space, Tag, Typography, message as antdMessage } from 'antd';
import { ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { applyAiProposal } from '@/lib/ai-api';
import type { AiProposal, AiProposalEvent } from '@/lib/ai-types';

const { Text } = Typography;

const KIND_META: Record<string, { label: string; color: string }> = {
  'req.new': { label: '新建需求', color: 'blue' },
  'req.status': { label: '改需求状态', color: 'cyan' },
  'req.patch': { label: '改需求字段', color: 'cyan' },
  'task.new': { label: '新建任务', color: 'green' },
  'task.status': { label: '改任务状态', color: 'gold' },
  'contract.set': { label: '设置契约', color: 'purple' },
  'note.add': { label: '添加备注', color: 'default' }
};

function describeEvent(event: AiProposalEvent): string {
  const parts: string[] = [];
  if (event.requirementId) parts.push(String(event.requirementId));
  if (event.taskId) parts.push(String(event.taskId));
  if (event.status) parts.push(`→ ${event.status}`);
  if (event.title) parts.push(`「${String(event.title).slice(0, 28)}」`);
  if (event.summary) parts.push(String(event.summary).slice(0, 32));
  if (event.text) parts.push(String(event.text).slice(0, 32));
  if (event.priority) parts.push(`优先级 ${event.priority}`);
  if (event.agent) parts.push(`@${event.agent}`);
  return parts.join(' · ');
}

interface Props {
  project: string;
  proposal: AiProposal;
  onApplied?: () => void;
}

/**
 * 提案卡片：工具调用风格（折叠式）。
 *
 * 标题始终展示"工具调用：propose_events"+ 事件数；展开后看到事件列表。
 * 状态：
 *   - pending：可应用 / 丢弃
 *   - applied：折叠展示 + 绿色对勾
 *   - discarded：本地已被用户隐藏（外层 ChatPanel 负责不渲染）
 */
export function ProposalCard({ project, proposal, onApplied }: Props) {
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleApply = async () => {
    if (applying || proposal.status !== 'pending') return;
    setApplying(true);
    try {
      const result = await applyAiProposal(project, proposal.id);
      antdMessage.success(`已应用 ${result.applied} 条事件到看板`);
      onApplied?.();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('应用失败');
      antdMessage.error(err.message);
    } finally {
      setApplying(false);
    }
  };

  const isPending = proposal.status === 'pending';
  const isApplied = proposal.status === 'applied';

  return (
    <div className={`tool-call-card status-${proposal.status}`}>
      <header className="tool-call-head" onClick={() => setExpanded((v) => !v)}>
        <Space size="small">
          <ApiOutlined className="tool-call-icon" />
          <Text strong>工具调用</Text>
          <Tag color="geekblue">propose_events</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {proposal.events.length} 条事件
          </Text>
          {isApplied && (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              已应用
            </Tag>
          )}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {expanded ? '▾' : '▸'}
        </Text>
      </header>

      {expanded && (
        <>
          <ul className="tool-call-events">
            {proposal.events.map((event, i) => {
              const meta = KIND_META[event.kind] || {
                label: event.kind,
                color: 'default'
              };
              return (
                <li key={i}>
                  <Tag color={meta.color} className="tool-call-kind">
                    {meta.label}
                  </Tag>
                  <span className="tool-call-desc">{describeEvent(event)}</span>
                </li>
              );
            })}
          </ul>

          {isPending && (
            <div className="tool-call-foot">
              <Button
                size="small"
                type="primary"
                loading={applying}
                onClick={handleApply}
                icon={<CheckCircleOutlined />}
              >
                应用到看板
              </Button>
              <Button
                size="small"
                type="text"
                icon={<CloseCircleOutlined />}
                onClick={() => setExpanded(false)}
              >
                折叠
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}