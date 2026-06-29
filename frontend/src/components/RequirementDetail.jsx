import { useEffect, useMemo, useState } from 'react';
import { Descriptions, Tag, Typography, List, Space, Tabs, Card, Empty, Button } from 'antd';
import { statusLabel, priorityColor, roleColor, roleLabel } from '../utils';
import { TaskDrawer } from './TaskDrawer';
import { RequirementHistory } from './RequirementHistory';

const { Title, Paragraph, Text } = Typography;

export function RequirementDetail({ project, item, taskItems, selectedTaskKey, filters, onTaskSelect }) {
  const [activeTab, setActiveTab] = useState('details');
  const [drawerTask, setDrawerTask] = useState(null);

  useEffect(() => {
    if (selectedTaskKey) {
      setActiveTab('tasks');
    }
  }, [selectedTaskKey]);

  useEffect(() => {
    setDrawerTask(null);
  }, [item?.id]);

  const tasks = item?.tasks || [];
  const filteredTasks = useMemo(() => {
    const q = (filters?.query || '').trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesRole = !filters?.role || filters.role === 'all' || task.role === filters.role;
      const haystack = [task.taskId, task.role, task.title, task.scope, task.agent]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesRole && matchesQuery;
    });
  }, [filters?.query, filters?.role, tasks]);

  if (!item) {
    return <div className="empty-state">请选择一条需求</div>;
  }

  const openTask = (task) => {
    const full = taskItems.find((t) => t.taskKey === `${item.id}::${task.taskId}`);
    setDrawerTask(full || task);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ paddingLeft: 16, paddingRight: 16 }}>
        <Tabs.TabPane tab="详情" key="details" />
        <Tabs.TabPane tab={`任务 (${filteredTasks.length}/${tasks.length})`} key="tasks" />
        <Tabs.TabPane tab={`契约 (${item.contract?.endpoints?.length || 0})`} key="contract" />
        <Tabs.TabPane tab="历史" key="history" />
      </Tabs>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'details' && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="计划周">{item.week || '-'}</Descriptions.Item>
              <Descriptions.Item label="截止日">{item.dueDate || '无'}</Descriptions.Item>
              <Descriptions.Item label="负责人">{item.owner || '未分配'}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{item.updatedAt || '-'}</Descriptions.Item>
            </Descriptions>

            <Card title="摘要" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
              <Paragraph style={{ color: '#475467' }}>{item.summary || '暂无摘要'}</Paragraph>
            </Card>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Card title="目标" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
                <Paragraph style={{ color: '#475467' }}>{item.detail?.goal || item.summary || '暂无目标'}</Paragraph>
              </Card>
              <Card title="下一步" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
                <Paragraph style={{ color: '#475467' }}>{item.detail?.next || '暂无下一步'}</Paragraph>
              </Card>
            </Space>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Card title="范围" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
                <List
                  size="small"
                  dataSource={item.detail?.scope || []}
                  locale={{ emptyText: '暂无范围描述' }}
                  renderItem={(text) => <List.Item style={{ borderColor: '#dfe5ee' }}>{text}</List.Item>}
                />
              </Card>
              <Card title="不做范围" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
                <List
                  size="small"
                  dataSource={item.detail?.nonGoals || []}
                  locale={{ emptyText: '暂无不做范围' }}
                  renderItem={(text) => <List.Item style={{ borderColor: '#dfe5ee' }}>{text}</List.Item>}
                />
              </Card>
            </Space>

            <Card title="验收点" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
              <List
                size="small"
                dataSource={item.acceptance || []}
                locale={{ emptyText: '暂无验收点' }}
                renderItem={(text) => <List.Item style={{ borderColor: '#dfe5ee' }}>{text}</List.Item>}
              />
            </Card>

            <Card title="关联文档" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
              <Space wrap>
                {(item.links || []).map((link) => (
                  <Button key={link.href} type="link" href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </Button>
                ))}
                {(item.links || []).length === 0 && <Text type="secondary">暂无关联文档</Text>}
              </Space>
            </Card>
          </Space>
        )}

        {activeTab === 'tasks' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {tasks.length === 0 ? (
              <Empty description="该需求暂无任务" />
            ) : filteredTasks.length === 0 ? (
              <Empty description="当前筛选下无匹配任务" />
            ) : (
              filteredTasks.map((task) => {
                const taskKey = `${item.id}::${task.taskId}`;
                return (
                  <Card
                    key={task.taskId}
                    size="small"
                    className={`task-card role-${task.role}${selectedTaskKey === taskKey ? ' active' : ''}`}
                    style={{ background: '#ffffff', borderColor: '#dfe5ee', cursor: 'pointer' }}
                    onClick={() => openTask(task)}
                    hoverable
                  >
                    <Space>
                      <Text type="secondary">{task.taskId}</Text>
                      <Tag color={roleColor(task.role)}>{roleLabel(task.role)}</Tag>
                      <Tag color={statusLabel(task.status).color}>{statusLabel(task.status).label}</Tag>
                      <Text strong>{task.title || task.taskId}</Text>
                      <Text type="secondary">{task.agent || '未领取'}</Text>
                    </Space>
                  </Card>
                );
              })
            )}
          </Space>
        )}

        {activeTab === 'contract' && (
          <Card title="接口契约" size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
            <List
              size="small"
              dataSource={item.contract?.endpoints || []}
              locale={{ emptyText: '暂无结构化接口契约' }}
              renderItem={(ep) => (
                <List.Item style={{ borderColor: '#dfe5ee' }}>
                  <Space direction="vertical" size={4}>
                    <Text strong>{(ep.method || 'METHOD').toUpperCase()} {ep.path || '-'}</Text>
                    <Space wrap>
                      {ep.permission && <Tag>权限：{ep.permission}</Tag>}
                      {ep.reasonRequired && <Tag>需要 reason</Tag>}
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {activeTab === 'history' && (
          <RequirementHistory
            project={project}
            requirementId={item.id}
            selectedTaskKey={selectedTaskKey}
            onTaskSelect={onTaskSelect}
          />
        )}
      </div>

      <TaskDrawer task={drawerTask} onClose={() => setDrawerTask(null)} />
    </div>
  );
}
