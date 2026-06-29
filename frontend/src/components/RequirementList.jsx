import { useMemo } from 'react';
import { Empty, Tag, Typography, Space, Button, Input, Select, Radio, Progress } from 'antd';
import { statusLabel, priorityColor, roleLabel, unique } from '../utils';

const { Text } = Typography;

const REQUIREMENT_STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'done', label: '完成' }
];

export function RequirementList({ data, taskItems, selected, onSelect, filters, setFilters }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="requirement-filters">
        <Input.Search
          placeholder="搜索标题、编号、摘要..."
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          className="filter-search"
        />
        <Select
          value={filters.type}
          onChange={(v) => setFilters({ ...filters, type: v })}
          className="filter-select"
          options={[{ value: 'all', label: '全部类型' }, ...types.map((t) => ({ value: t, label: t }))]}
        />
        <Select
          value={filters.role}
          onChange={(v) => setFilters({ ...filters, role: v })}
          className="filter-select"
          options={[{ value: 'all', label: '全部角色' }, ...roles.map((r) => ({ value: r, label: roleLabel(r) }))]}
        />
        <Select
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v })}
          className="filter-select"
          options={REQUIREMENT_STATUS_OPTIONS}
        />
        <Select
          value={filters.priority}
          onChange={(v) => setFilters({ ...filters, priority: v })}
          className="filter-select"
          options={[{ value: 'all', label: '全部优先级' }, ...priorities.map((p) => ({ value: p, label: p }))]}
        />
      </div>

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
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {filteredItems.length === 0 ? (
            <Empty description="暂无匹配需求" />
          ) : filteredItems.map((item) => {
            const stats = item.taskStats || { total: 0, done: 0, blocked: 0 };
            const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

            return (
              <Button
                key={item.id}
                type="text"
                block
                className={`requirement-list-item${selected === item.id ? ' active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <div className="requirement-list-row">
                  <Space wrap size={6}>
                    <Tag>{item.id}</Tag>
                    <Tag color={priorityColor(item.priority)}>{item.priority || '-'}</Tag>
                    <Tag color={statusLabel(item.status).color}>{statusLabel(item.status).label}</Tag>
                    <Tag>{item.type}</Tag>
                  </Space>
                  <Text strong className="requirement-list-title">{item.title}</Text>
                  <Text type="secondary" className="requirement-list-meta">
                    <span className="requirement-list-meta-progress">
                      <Progress percent={percent} size="small" showInfo={false} />
                      <span className="requirement-list-meta-text">任务 {stats.done || 0}/{stats.total || 0}</span>
                    </span>
                    {stats.blocked > 0 && <span className="requirement-list-meta-blocked">阻塞 {stats.blocked}</span>}
                    <span className="requirement-list-meta-date">{item.updatedAt || '-'}</span>
                  </Text>
                </div>
              </Button>
            );
          })}
        </Space>
      </div>
    </div>
  );
}
