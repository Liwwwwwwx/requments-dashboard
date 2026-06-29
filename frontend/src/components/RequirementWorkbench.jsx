import { Card, Empty, Progress, Space, Tag, Typography, Button, List } from 'antd';
import { statusLabel, priorityColor, roleColor, roleLabel } from '../utils';

const { Title, Text, Paragraph } = Typography;

const ROLE_ORDER = ['contract', 'frontend', 'backend', 'review', 'qa', 'integration', 'infra', 'general'];

export function RequirementWorkbench({ item, selectedTaskKey, onTaskSelect }) {
  if (!item) {
    return <div className="empty-state">请选择一条需求</div>;
  }

  const tasks = item.tasks || [];
  const taskStats = item.taskStats || { total: 0, done: 0, active: 0, blocked: 0 };
  const progress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;
  const blockedTasks = tasks.filter((task) => task.status === 'blocked');

  return (
    <div className="workbench">
      <section className="workbench-header">
        <div>
          <Space wrap>
            <Tag>{item.id}</Tag>
            <Tag color={priorityColor(item.priority)}>{item.priority || '-'}</Tag>
            <Tag color={statusLabel(item.status).color}>{statusLabel(item.status).label}</Tag>
            <Tag>{item.type}</Tag>
          </Space>
          <Title level={3} className="workbench-title">{item.title}</Title>
          <Text type="secondary">{item.owner || '未分配'} · {item.updatedAt || '-'} · {item.workflowStatus || '未登记'}</Text>
        </div>
        <div className="workbench-progress">
          <Progress type="circle" percent={progress} size={72} />
          <Text type="secondary">任务 {taskStats.done || 0}/{taskStats.total || 0}</Text>
        </div>
      </section>

      <section className="workbench-summary">
        <Card size="small" title="摘要" className="surface-card">
          <Paragraph className="muted-paragraph clamped" ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}>
            {item.summary || item.detail?.goal || '暂无摘要'}
          </Paragraph>
        </Card>
        <Card size="small" title="下一步" className="surface-card">
          <Paragraph className="muted-paragraph clamped" ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
            {item.detail?.next || '暂无下一步'}
          </Paragraph>
        </Card>
      </section>

      {blockedTasks.length > 0 && (
        <Card size="small" title="阻塞项" className="surface-card">
          <List
            size="small"
            dataSource={blockedTasks}
            renderItem={(task) => (
              <List.Item className="light-list-item">
                <Space>
                  <Tag color={roleColor(task.role)}>{roleLabel(task.role)}</Tag>
                  <Text strong>{task.taskId}</Text>
                  <Text>{task.title}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      <section className="role-task-grid">
        {groupTasksByRole(tasks).map(([role, roleTasks]) => {
          const done = roleTasks.filter((task) => task.status === 'done' || task.status === 'accepted').length;
          const blocked = roleTasks.filter((task) => task.status === 'blocked').length;

          return (
            <Card
              key={role}
              size="small"
              className={`role-card role-${role}`}
              title={
                <Space>
                  <Tag color={roleColor(role)}>{roleLabel(role)}</Tag>
                  <Text type="secondary">{done}/{roleTasks.length}</Text>
                  {blocked > 0 && <Tag color="error">阻塞 {blocked}</Tag>}
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {roleTasks.map((task) => {
                  const taskKey = `${item.id}::${task.taskId}`;
                  const active = selectedTaskKey === taskKey;

                  return (
                    <Button
                      key={task.taskId}
                      block
                      type="text"
                      className={`workbench-task${active ? ' active' : ''}`}
                      onClick={() => onTaskSelect(item.id, taskKey)}
                    >
                      <span className="workbench-task-id">{task.taskId}</span>
                      <Tag color={statusLabel(task.status).color}>{statusLabel(task.status).label}</Tag>
                      <span className="workbench-task-title">{task.title || task.taskId}</span>
                      <span className="workbench-task-agent">{task.agent || '未领取'}</span>
                    </Button>
                  );
                })}
              </Space>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function groupTasksByRole(tasks) {
  const groups = new Map();
  for (const task of tasks || []) {
    const role = task.role || 'general';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(task);
  }
  return ROLE_ORDER
    .map((role) => [role, groups.get(role) || []])
    .filter(([, roleTasks]) => roleTasks.length > 0);
}
