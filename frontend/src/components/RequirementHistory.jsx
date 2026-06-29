import { useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Spin, Tag, Timeline, Typography, Space, Button } from 'antd';
import { fetchRequirementEvents } from '../api';
import { statusLabel } from '../utils';

const { Text, Paragraph } = Typography;

export function RequirementHistory({ project, requirementId, selectedTaskKey, onTaskSelect }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project || !requirementId) {
      setEvents([]);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    fetchRequirementEvents(project, requirementId)
      .then((res) => {
        if (!alive) return;
        setEvents(res.events || []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [project, requirementId]);

  const items = useMemo(() => {
    return [...events]
      .sort((a, b) => eventTimeValue(b) - eventTimeValue(a))
      .map((wrapped) => {
        const event = wrapped.event || wrapped;
        const taskKey = event.taskId ? `${event.requirementId}::${event.taskId}` : null;
        const active = taskKey && taskKey === selectedTaskKey;
        const item = formatEvent(event);

        return {
          color: eventColor(event.kind || event.type),
          children: (
            <div className={active ? 'history-event active' : 'history-event'}>
              <Space wrap size={6}>
                <Tag>{item.kindLabel}</Tag>
                {event.taskId && <Tag>{event.taskId}</Tag>}
                {event.actor && <Tag>{event.actor}</Tag>}
              </Space>
              <div className="history-event-title">{item.title}</div>
              <Text type="secondary">{formatEventTime(event)}</Text>
              {item.description && <Paragraph className="history-event-description">{item.description}</Paragraph>}
              {taskKey && (
                <Button size="small" type="link" onClick={() => onTaskSelect(event.requirementId, taskKey)}>
                  定位任务
                </Button>
              )}
            </div>
          )
        };
      });
  }, [events, onTaskSelect, selectedTaskKey]);

  if (!requirementId) {
    return <div className="empty-state">请选择一条需求</div>;
  }

  if (error) {
    return <Alert type="error" showIcon message="历史加载失败" description={error} />;
  }

  return (
    <Spin spinning={loading}>
      {items.length === 0 ? (
        <Empty description="暂无历史事件" />
      ) : (
        <Timeline items={items} />
      )}
    </Spin>
  );
}

function formatEvent(event) {
  const kind = event.kind || event.type;

  if (kind === 'req.new') {
    return { kindLabel: '需求', title: '创建需求', description: event.title || event.summary || '' };
  }
  if (kind === 'req.status') {
    return {
      kindLabel: '需求',
      title: `状态更新为 ${statusLabel(event.status).label}`,
      description: event.workflowStatus ? `工作流：${event.workflowStatus}${event.next ? `；下一步：${event.next}` : ''}` : event.next || ''
    };
  }
  if (kind === 'req.patch') {
    const fields = ['title', 'summary', 'priority', 'owner', 'week', 'dueDate', 'status', 'workflowStatus', 'detail', 'acceptance', 'links', 'sources']
      .filter((field) => event[field] !== undefined);
    return { kindLabel: '需求', title: '更新需求字段', description: fields.join(' / ') || '需求内容已更新' };
  }
  if (kind === 'task.new') {
    return { kindLabel: '任务', title: `新增任务 ${event.taskId}`, description: event.title || event.scope || '' };
  }
  if (kind === 'task.status') {
    return {
      kindLabel: '任务',
      title: `${event.taskId} 状态更新为 ${statusLabel(event.status).label}`,
      description: [event.agent ? `Agent：${event.agent}` : '', event.verify ? `验证：${event.verify}` : '', event.notes || '']
        .filter(Boolean)
        .join('；')
    };
  }
  if (kind === 'contract.set') {
    const count = Array.isArray(event.endpoints) ? event.endpoints.length : 0;
    return { kindLabel: '契约', title: `更新接口契约，${count} 个 endpoint`, description: '' };
  }
  if (kind === 'note.add') {
    return { kindLabel: '备注', title: '新增备注', description: event.text || '' };
  }

  return { kindLabel: kind || '事件', title: kind || '未知事件', description: '' };
}

function eventColor(kind) {
  if (kind === 'req.new' || kind === 'task.new') return 'green';
  if (kind === 'req.status' || kind === 'task.status') return 'blue';
  if (kind === 'contract.set') return 'purple';
  if (kind === 'note.add') return 'gray';
  return 'gray';
}

function eventTimeValue(event) {
  if (event.at) return Date.parse(event.at) || 0;
  if (event.updatedAt) return Date.parse(`${event.updatedAt}T00:00:00`) || 0;
  return Number(event.ts || 0);
}

function formatEventTime(event) {
  if (event.at) return event.at.replace('T', ' ').replace(/\.\d{3}Z$/, '');
  if (event.updatedAt) return event.updatedAt;
  if (event.ts) return new Date(event.ts).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  return '-';
}
