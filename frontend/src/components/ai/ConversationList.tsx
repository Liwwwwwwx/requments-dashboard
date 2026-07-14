'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Modal, Tooltip, Typography, message as antdMessage } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { deleteAiConversation, listAiConversations, renameAiConversation } from '@/lib/ai-api';
import type { AiConversation } from '@/lib/ai-types';

const { Text } = Typography;

interface Props {
  project: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  /** 删除后由父组件决定要不要清空主面板（一般是切到 null） */
  onDeleted?: (id: string) => void;
  disabled?: boolean;
}

/** "今天 / 本周 / 本月 / 更早" 时间分组 */
function timeGroup(ts: number): 'today' | 'week' | 'month' | 'earlier' {
  const now = Date.now();
  const diff = now - ts;
  const ONE_DAY = 24 * 3600 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (ts >= startOfToday.getTime()) return 'today';
  if (diff < 7 * ONE_DAY) return 'week';
  if (diff < 30 * ONE_DAY) return 'month';
  return 'earlier';
}

const GROUP_LABEL: Record<string, string> = {
  today: '今天',
  week: '本周',
  month: '本月',
  earlier: '更早'
};

const GROUP_ORDER: Array<'today' | 'week' | 'month' | 'earlier'> = [
  'today',
  'week',
  'month',
  'earlier'
];

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 文本高亮：query 匹配的字符包 <mark>。
 * 忽略 query 大小写；保留原文大小写。
 */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark key={key++}>{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
  }
  return <>{parts}</>;
}

export function ConversationList({
  project,
  selectedId,
  onSelect,
  onNew,
  onDeleted,
  disabled
}: Props) {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [busyDelete, setBusyDelete] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await listAiConversations(project);
      setConversations(res.conversations);
    } catch {
      // 静默
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listAiConversations(project);
        if (!cancelled) setConversations(res.conversations);
      } catch {
        // 静默
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const text = (c.title || c.id).toLowerCase();
      return text.includes(q);
    });
  }, [conversations, query]);

  // 按时间分组
  const grouped = useMemo(() => {
    const buckets: Record<string, AiConversation[]> = {
      today: [],
      week: [],
      month: [],
      earlier: []
    };
    for (const c of filtered) {
      buckets[timeGroup(c.updatedAt)].push(c);
    }
    // 每组内按 updatedAt DESC
    for (const k of GROUP_ORDER) {
      buckets[k].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return GROUP_ORDER.map((k) => ({ key: k, label: GROUP_LABEL[k], items: buckets[k] })).filter(
      (g) => g.items.length > 0
    );
  }, [filtered]);

  const handleStartEdit = (c: AiConversation) => {
    setEditingId(c.id);
    setEditingValue(c.title || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    if (!trimmed) {
      antdMessage.warning('标题不能为空');
      return;
    }
    try {
      await renameAiConversation(project, editingId, trimmed);
      antdMessage.success('已改名');
      setEditingId(null);
      setEditingValue('');
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '改名失败';
      antdMessage.error(msg);
    }
  };

  const handleDelete = (c: AiConversation) => {
    Modal.confirm({
      title: '删除会话？',
      content: (
        <span>
          会话「{c.title || c.id}」及其所有消息将被永久删除，且无法恢复。
        </span>
      ),
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setBusyDelete(c.id);
        try {
          await deleteAiConversation(project, c.id);
          antdMessage.success('已删除');
          await refresh();
          onDeleted?.(c.id);
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : '删除失败');
        } finally {
          setBusyDelete(null);
        }
      }
    });
  };

  return (
    <aside className="conv-list">
      <header className="conv-list-header">
        <div className="conv-list-title">
          <span>会话</span>
          <span>当前项目</span>
        </div>
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={onNew}
          disabled={disabled}
          block
        >
          新建会话
        </Button>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索会话"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          size="small"
        />
      </header>

      {grouped.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {query ? '没有匹配' : '还没有历史会话'}
            </Text>
          }
          style={{ marginTop: 24 }}
        />
      ) : (
        <div className="conv-list-scroll">
          {grouped.map((group) => (
            <section key={group.key} className="conv-list-group">
              <div className="conv-list-group-label">{group.label}</div>
              <ul className="conv-list-items">
                {group.items.map((c) => {
                  const active = c.id === selectedId;
                  const isEditing = editingId === c.id;
                  return (
                    <li
                      key={c.id}
                      className={`conv-list-item ${active ? 'is-active' : ''} ${isEditing ? 'is-editing' : ''}`}
                      onClick={() => !isEditing && onSelect(c.id)}
                    >
                      <div className="conv-list-item-icon">
                        <MessageOutlined />
                      </div>
                      <div className="conv-list-item-body">
                        {isEditing ? (
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onPressEnter={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={handleSaveEdit}
                            autoFocus
                            size="small"
                            status={editingValue.trim() ? '' : 'error'}
                          />
                        ) : (
                          <>
                            <div
                              className="conv-list-item-title"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(c);
                              }}
                            >
                              <Highlight
                                text={c.title || `会话 ${c.id.slice(-6)}`}
                                query={query}
                              />
                            </div>
                            <div className="conv-list-item-meta">
                              {relativeTime(c.updatedAt)}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="conv-list-item-actions">
                        {!isEditing && (
                          <Tooltip title="改名">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(c);
                              }}
                              className="conv-list-item-action"
                            />
                          </Tooltip>
                        )}
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(c);
                            }}
                            loading={busyDelete === c.id}
                            className="conv-list-item-action"
                          />
                        </Tooltip>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
ConversationList.displayName = 'ConversationList';
