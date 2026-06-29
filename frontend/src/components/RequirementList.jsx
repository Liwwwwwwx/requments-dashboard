import { useMemo, useState } from 'react';
import { Card, Tag, Typography, Space, Collapse, Button, Input, Select, Radio } from 'antd';
import { statusLabel, priorityColor, roleColor, roleLabel, unique } from '../utils';

const { Text } = Typography;
const { Panel } = Collapse;

const REQUIREMENT_STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'done', label: '完成' }
];

export function RequirementList({ data, taskItems, selected, selectedTaskKey, onSelect, filters, setFilters }) {
  const [expanded, setExpanded] = useState([]);

  const types = useMemo(() => unique(data.items.map((i) => i.type)), [data.items]);
  const roles = useMemo(() => unique(taskItems.map((t) => t.role)), [taskItems]);
  const priorities = useMemo(() => unique(data.items.map((i) => i.priority)), [data.items]);
  const weeks = useMemo(() => unique(data.items.map((i) => i.week)).reverse(), [data.items]);

  const filteredItems = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return data.items.filter((item) => {
      const taskText = (item.tasks || [])
        .map((task) => [task.taskId, task.role, task.title, task.scope, task.agent].filter(Boolean).join(' '))
        .join(' ');
      const haystack = [item.id, item.title, item.summary, item.owner, item.type, item.week, taskText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesWeek = filters.week === 'all' || item.week === filters.week;
      const matchesType = filters.type === 'all' || item.type === filters.type;
      const matchesPriority = filters.priority === 'all' || item.priority === filters.priority;
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesRole = filters.role === 'all' || (item.tasks || []).some((t) => t.role === filters.role);
      return matchesQuery && matchesWeek && matchesType && matchesPriority && matchesStatus && matchesRole;
    });
  }, [data.items, filters]);

  const handleItemClick = (item) => {
    onSelect(item.id);
    if (!expanded.includes(item.id)) {
      setExpanded([...expanded, item.id]);
    }
  };

  const handleTaskClick = (taskKey) => {
    const [reqId] = taskKey.split('::');
    onSelect(reqId, taskKey);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="搜索标题、编号、摘要、负责人"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          style={{ width: 220 }}
        />
        <Select
          value={filters.type}
          onChange={(v) => setFilters({ ...filters, type: v })}
          style={{ width: 120 }}
          options={[{ value: 'all', label: '全部类型' }, ...types.map((t) => ({ value: t, label: t }))]}
        />
        <Select
          value={filters.role}
          onChange={(v) => setFilters({ ...filters, role: v })}
          style={{ width: 120 }}
          options={[{ value: 'all', label: '全部角色' }, ...roles.map((r) => ({ value: r, label: roleLabel(r) }))]}
        />
        <Select
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v })}
          style={{ width: 120 }}
          options={REQUIREMENT_STATUS_OPTIONS}
        />
        <Select
          value={filters.priority}
          onChange={(v) => setFilters({ ...filters, priority: v })}
          style={{ width: 120 }}
          options={[{ value: 'all', label: '全部优先级' }, ...priorities.map((p) => ({ value: p, label: p }))]}
        />
      </Space>

      <Radio.Group
        value={filters.week}
        onChange={(e) => setFilters({ ...filters, week: e.target.value })}
        buttonStyle="solid"
        size="small"
        style={{ marginBottom: 12 }}
      >
        <Radio.Button value="all">全部周</Radio.Button>
        {weeks.map((w) => (
          <Radio.Button key={w} value={w}>{w}</Radio.Button>
        ))}
      </Radio.Group>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Collapse
          activeKey={expanded}
          onChange={setExpanded}
          ghost
        >
          {filteredItems.map((item) => (
            <Panel
              key={item.id}
              header={
                <div onClick={() => handleItemClick(item)} style={{ flex: 1 }}>
                  <Space wrap>
                    <Tag>{item.id}</Tag>
                    <Tag color={priorityColor(item.priority)}>{item.priority || '-'}</Tag>
                    <Tag color={statusLabel(item.status).color}>{statusLabel(item.status).label}</Tag>
                    <Tag>{item.type}</Tag>
                    <Text strong style={{ color: selected === item.id ? '#0f9f8f' : '#17212f' }}>{item.title}</Text>
                  </Space>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">{item.owner || '未分配'} · {item.updatedAt} · 任务 {item.taskStats?.done || 0}/{item.taskStats?.total || 0}</Text>
                  </div>
                </div>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {groupTasksByRole(item.tasks).map(([role, tasks]) => (
                  <Card key={role} size="small" style={{ background: '#f8fafc', borderColor: '#dfe5ee' }} title={<Tag color={roleColor(role)}>{roleLabel(role)} {tasks.length}</Tag>}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {tasks.map((task) => {
                        const taskKey = `${item.id}::${task.taskId}`;
                        const isSelectedTask = selectedTaskKey === taskKey;
                        return (
                          <Button
                            key={task.taskId}
                            type="text"
                            block
                            style={{
                              textAlign: 'left',
                              height: 'auto',
                              padding: '8px 12px',
                              background: isSelectedTask ? 'rgba(15, 159, 143, 0.1)' : undefined
                            }}
                            onClick={() => handleTaskClick(taskKey)}
                          >
                            <Space>
                              <Text type="secondary">{task.taskId}</Text>
                              <Tag color={statusLabel(task.status).color}>{statusLabel(task.status).label}</Tag>
                              <Text>{task.title}</Text>
                              <Text type="secondary">{task.agent || '未领取'}</Text>
                            </Space>
                          </Button>
                        );
                      })}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Panel>
          ))}
        </Collapse>
      </div>
    </div>
  );
}

function groupTasksByRole(tasks) {
  const order = ['contract', 'frontend', 'backend', 'review', 'qa', 'integration', 'infra'];
  const groups = new Map();
  for (const task of tasks || []) {
    const role = task.role || 'general';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(task);
  }
  return order.map((role) => [role, groups.get(role) || []]).filter(([_, tasks]) => tasks.length > 0);
}
