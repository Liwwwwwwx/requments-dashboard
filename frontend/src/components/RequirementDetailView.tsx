'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Form, Input, Modal, Select, Space, Typography, message } from 'antd';
import { addRequirementNote, fetchRequirementEvents, updateRequirement } from '@/lib/api';
import { priorityChipClass, statusChipClass, statusLabel } from '@/lib/utils';
import type { Priority, Requirement, RequirementEvent, RequirementStatus } from '@/lib/types';

const { Paragraph } = Typography;

interface Props {
  item: Requirement | null;
  project: string;
  onUpdated?: () => Promise<void> | void;
}

interface RequirementEditForm {
  title: string;
  description?: string;
  status: RequirementStatus;
  priority: Priority;
  owner?: string;
}

function eventPayload(event: RequirementEvent): Record<string, unknown> {
  return (event.event || event) as Record<string, unknown>;
}

function eventStatus(event: RequirementEvent): string | undefined {
  const payload = eventPayload(event);
  return String(event.status || payload.status || '');
}

function historyTitle(event: RequirementEvent): string {
  const kind = event.kind || eventPayload(event).kind;
  if (kind === 'req.new') return '新建需求';
  if (kind === 'req.patch') return '更新基础信息';
  if (kind === 'req.status') {
    const status = eventStatus(event);
    return `状态变更 → ${status ? statusLabel(status).label : '-'}`;
  }
  if (kind === 'note.add') return '添加备注';
  if (kind === 'task.new') return `新建任务${event.taskId ? ` ${event.taskId}` : ''}`;
  if (kind === 'task.status') {
    const status = eventStatus(event);
    return `任务状态 → ${status ? statusLabel(status).label : '-'}`;
  }
  return String(kind || '未知事件');
}

function historyDetail(event: RequirementEvent): string {
  const payload = eventPayload(event);
  const kind = event.kind || payload.kind;
  if (kind === 'req.new') return String(payload.title || event.title || '创建了需求');
  if (kind === 'req.status') return `状态更新为 ${statusLabel(eventStatus(event) || '').label}`;
  if (kind === 'note.add') return String(payload.text || event.text || '添加了一条备注');
  if (kind === 'req.patch') {
    const fields = [
      payload.title !== undefined ? '标题' : '',
      payload.summary !== undefined ? '描述' : '',
      payload.priority !== undefined ? '优先级' : '',
      payload.owner !== undefined ? '负责人' : ''
    ].filter(Boolean);
    return fields.length > 0 ? `更新：${fields.join('、')}` : '更新了需求信息';
  }
  return event.taskId || event.summary || event.text || '';
}

function historyTime(event: RequirementEvent): string {
  if (event.ts) {
    return new Date(event.ts).toLocaleString('zh-CN', { hour12: false });
  }
  return event.updatedAt || event.at || '-';
}

export function RequirementDetailView({ item, project, onUpdated }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<RequirementEditForm>();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [history, setHistory] = useState<RequirementEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setNoteOpen(false);
    setNoteText('');
  }, [item?.id]);

  const loadHistory = async () => {
    if (!item) {
      setHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetchRequirementEvents(project, item.id);
      setHistory(res.events || []);
    } catch (error) {
      setHistory([]);
      setHistoryError(error instanceof Error ? error.message : '加载变更历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function run() {
      if (!item) {
        setHistory([]);
        setHistoryError(null);
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetchRequirementEvents(project, item.id);
        if (active) setHistory(res.events || []);
      } catch (error) {
        if (!active) return;
        setHistory([]);
        setHistoryError(error instanceof Error ? error.message : '加载变更历史失败');
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [project, item]);

  const handleBack = () => {
    router.push(`/p/${project}`);
  };

  const openAi = () => {
    if (!item) return;
    router.push(`/p/${project}/ai?requirementId=${encodeURIComponent(item.id)}`);
  };

  const openEdit = () => {
    if (!item) return;
    form.setFieldsValue({
      title: item.title,
      description: item.summary || item.detail?.goal || '',
      status: item.status,
      priority: item.priority || 'P1',
      owner: item.owner || ''
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!item) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await updateRequirement(project, item.id, {
        title: values.title.trim(),
        description: values.description?.trim() || '',
        status: values.status,
        priority: values.priority,
        owner: values.owner?.trim() || ''
      });
      message.success('需求已更新');
      setEditing(false);
      await onUpdated?.();
      await loadHistory();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新需求失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!item) return;
    const text = noteText.trim();
    if (!text) {
      message.warning('请输入备注内容');
      return;
    }
    setNoteSaving(true);
    try {
      await addRequirementNote(project, item.id, text);
      message.success('备注已添加');
      setNoteText('');
      setNoteOpen(false);
      await onUpdated?.();
      await loadHistory();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '添加备注失败');
    } finally {
      setNoteSaving(false);
    }
  };

  if (!item) {
    return (
      <div className="empty-state">
        <div>
          <div className="glyph">∅</div>
          <div>请选择一条需求</div>
        </div>
      </div>
    );
  }

  const status = statusLabel(item.status);

  return (
    <div className="view-detail">
      <header className="view-detail-header">
        <div className="view-detail-topline">
          <div className="view-detail-eyebrow">
            <span className="id">{item.id}</span>
            <span>·</span>
            <span>需求详情</span>
          </div>
          <Space className="view-detail-actions" size={8}>
            <Button size="small" onClick={openAi}>
              问 AI
            </Button>
            <Button size="small" onClick={openEdit}>
              编辑需求
            </Button>
            <button type="button" className="view-detail-back" onClick={handleBack}>
              <span className="arrow">←</span>
              <span>返回列表</span>
            </button>
          </Space>
        </div>
        <h1 className="view-detail-title">{item.title}</h1>
        <div className="view-detail-chips">
          {item.priority && (
            <span className={`chip ${priorityChipClass(item.priority)}`}>
              <span className="chip-dot" />
              {item.priority}
            </span>
          )}
          <span className={`chip ${statusChipClass(item.status)}`}>
            <span className="chip-dot" />
            {status.label}
          </span>
          {item.type && <span className="chip">{item.type}</span>}
          {item.week && <span className="chip chip-mono">{item.week}</span>}
        </div>
        <div className="view-detail-meta">
          <span className="kv">
            <span className="k">负责人</span>
            <span className="v">{item.owner || '未分配'}</span>
          </span>
          <span className="dot">·</span>
          <span className="kv">
            <span className="k">创建时间</span>
            <span className="v">{item.createdAt || '-'}</span>
          </span>
          <span className="dot">·</span>
          <span className="kv">
            <span className="k">更新时间</span>
            <span className="v">{item.updatedAt || '-'}</span>
          </span>
          {item.dueDate && (
            <>
              <span className="dot">·</span>
              <span className="kv">
                <span className="k">截止</span>
                <span className="v">{item.dueDate}</span>
              </span>
            </>
          )}
        </div>
      </header>

      <div className="view-detail-grid">
        <div>
          {(item.summary || item.detail?.goal) && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">摘要</h3>
              <div className="view-detail-section-body">
                <Paragraph style={{ marginBottom: 0 }}>
                  {item.summary || item.detail?.goal}
                </Paragraph>
              </div>
            </section>
          )}

          {item.detail?.next && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">下一步</h3>
              <div className="view-detail-section-body">
                <Paragraph style={{ marginBottom: 0 }}>{item.detail.next}</Paragraph>
              </div>
            </section>
          )}

          {(item.detail?.scope?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                范围 <span className="count">· {item.detail.scope.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.detail.scope.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(item.detail?.nonGoals?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                不做范围 <span className="count">· {item.detail.nonGoals.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.detail.nonGoals.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(item.acceptance?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                验收点 <span className="count">· {item.acceptance.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.acceptance.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {(item.links?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">关联文档</h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.links.map((link, i) => (
                    <li key={i}>
                      <a href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="view-detail-section">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12
              }}
            >
              <h3 className="view-detail-section-title" style={{ marginBottom: 0 }}>
                <span>备注</span>
                {(item.notes?.length || 0) > 0 && (
                  <span className="count">· {item.notes.length}</span>
                )}
              </h3>
              <Button size="small" onClick={() => setNoteOpen(true)}>
                添加备注
              </Button>
            </div>
            <div className="view-detail-section-body">
              {(item.notes?.length || 0) === 0 ? (
                <div className="history-empty">暂无备注</div>
              ) : (
                <ol className="history-list">
                  {item.notes.map((note, index) => (
                    <li key={`${note.at}-${index}`} className="history-item">
                      <div className="history-detail">{note.text}</div>
                      <time className="history-time">{note.at || '-'}</time>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="view-detail-section">
            <h3 className="view-detail-section-title">
              <span>变更历史</span>
              {history.length > 0 && <span className="count">· {history.length}</span>}
            </h3>
            <div className="view-detail-section-body">
              {historyLoading ? (
                <div className="history-empty">加载中...</div>
              ) : historyError ? (
                <div className="history-empty">加载失败：{historyError}</div>
              ) : history.length === 0 ? (
                <div className="history-empty">暂无变更历史</div>
              ) : (
                <ol className="history-list">
                  {history.map((event, index) => (
                    <li key={event.eventId || `${event.kind}-${index}`} className="history-item">
                      <div className="history-item-head">
                        <span className="history-title">{historyTitle(event)}</span>
                        {event.actor && <span className="history-actor">{event.actor}</span>}
                      </div>
                      <div className="history-detail">{historyDetail(event)}</div>
                      <time className="history-time">{historyTime(event)}</time>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        <aside className="view-detail-aside">
          {(item.contract?.endpoints?.length || 0) > 0 && (
            <div className="stat-block">
              <div className="stat-block-label">接口契约</div>
              {item.contract.endpoints.map((ep, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 6,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                    {(ep.method || 'METHOD').toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--text-primary)', marginLeft: 6 }}>
                    {ep.path}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <Modal
        title="编辑需求"
        open={editing}
        onOk={() => void handleSave()}
        onCancel={() => setEditing(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, whitespace: true, message: '请输入需求标题' }]}
          >
            <Input placeholder="需求标题" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={4} placeholder="需求描述" />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              aria-label="状态"
              options={[
                { value: 'todo', label: '待开始' },
                { value: 'doing', label: '进行中' },
                { value: 'blocked', label: '阻塞' },
                { value: 'done', label: '完成' }
              ]}
            />
          </Form.Item>
          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select
              aria-label="优先级"
              options={[
                { value: 'P0', label: 'P0' },
                { value: 'P1', label: 'P1' },
                { value: 'P2', label: 'P2' }
              ]}
            />
          </Form.Item>
          <Form.Item label="负责人" name="owner">
            <Input placeholder="负责人" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="添加备注"
        open={noteOpen}
        onOk={() => void handleAddNote()}
        onCancel={() => setNoteOpen(false)}
        confirmLoading={noteSaving}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Input.TextArea
          aria-label="备注内容"
          rows={4}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="记录当前需求的背景、决策或后续跟进"
        />
      </Modal>
    </div>
  );
}
