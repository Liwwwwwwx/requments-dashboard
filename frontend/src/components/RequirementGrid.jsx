import { useMemo } from 'react';
import { Empty, Input, Select } from 'antd';
import {
  statusLabel,
  priorityChipClass,
  priorityBarClass,
  statusChipClass,
  unique
} from '../utils';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'todo', label: '待开始' },
  { value: 'doing', label: '进行中' },
  { value: 'paused', label: '暂停' },
  { value: 'done', label: '完成' }
];

export function RequirementGrid({
  data,
  taskItems,
  filters,
  setFilters,
  navFilter,
  selected,
  onSelect
}) {
  const types = useMemo(() => unique(data.items.map((i) => i.type)), [data.items]);
  const roles = useMemo(() => unique(taskItems.map((t) => t.role)), [taskItems]);
  const priorities = useMemo(() => unique(data.items.map((i) => i.priority)), [data.items]);
  const weeks = useMemo(() => unique(data.items.map((i) => i.week)).reverse(), [data.items]);

  const filteredItems = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return data.items.filter((item) => {
      // sidebar 导航筛选
      if (navFilter !== 'all' && item.status !== navFilter) return false;

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
  }, [data.items, filters, navFilter]);

  const navLabel = {
    all: '全部需求',
    doing: '进行中',
    todo: '待开始',
    paused: '暂停',
    done: '完成'
  }[navFilter] || '全部需求';

  return (
    <div className="view-list">
      <header className="view-list-head">
        <div>
          <h1 className="view-list-title">{navLabel}</h1>
          <div className="view-list-meta">
            <span>共 {data.items.length || 0} 条，当前显示 {filteredItems.length} 条</span>
            {filters.query && <span>· 搜索 "{filters.query}"</span>}
          </div>
        </div>
        <div className="view-list-filters">
          <Input.Search
            placeholder="搜索标题、编号、摘要..."
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={filters.type}
            onChange={(v) => setFilters({ ...filters, type: v })}
            style={{ width: 130 }}
            options={[{ value: 'all', label: '全部类型' }, ...types.map((t) => ({ value: t, label: t }))]}
          />
          <Select
            value={filters.role}
            onChange={(v) => setFilters({ ...filters, role: v })}
            style={{ width: 130 }}
            options={[{ value: 'all', label: '全部角色' }, ...roles.map((r) => ({ value: r, label: r }))]}
          />
          <Select
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            style={{ width: 130 }}
            options={STATUS_OPTIONS}
          />
          <Select
            value={filters.priority}
            onChange={(v) => setFilters({ ...filters, priority: v })}
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部优先级' },
              ...priorities.map((p) => ({ value: p, label: p }))
            ]}
          />
        </div>
      </header>

      {weeks.length > 0 && (
        <div className="week-tabs">
          <button
            type="button"
            className={`week-tab ${filters.week === 'all' ? 'active' : ''}`}
            onClick={() => setFilters({ ...filters, week: 'all' })}
          >
            全部
          </button>
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              className={`week-tab ${filters.week === w ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, week: w })}
            >
              {w}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <Empty description="暂无匹配需求" />
      ) : (
        <div className="req-grid">
          {filteredItems.map((item) => {
            const stats = item.taskStats || { total: 0, done: 0, blocked: 0 };
            const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            const status = statusLabel(item.status);
            const isActive = selected === item.id;
            const isBlocked = (stats.blocked || 0) > 0;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={[
                  'req-card',
                  priorityBarClass(item.priority),
                  isActive ? 'active' : ''
                ].join(' ').trim()}
                onClick={() => onSelect(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(item.id);
                  }
                }}
              >
                <div className="req-card-head">
                  <span className="req-card-id">{item.id}</span>
                  {item.priority && (
                    <span className={`chip ${priorityChipClass(item.priority)}`}>
                      <span className="chip-dot" />
                      {item.priority}
                    </span>
                  )}
                </div>

                <div className="req-card-title">{item.title}</div>

                <div className="req-card-chips">
                  <span className={`chip ${statusChipClass(item.status)}`}>
                    <span className="chip-dot" />
                    {status.label}
                  </span>
                  {item.type && <span className="chip">{item.type}</span>}
                </div>

                <div className="req-card-foot">
                  <div className="req-card-progress">
                    <div className={isBlocked ? 'bar is-blocked' : 'bar'}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <span className="count">{stats.done || 0}/{stats.total || 0}</span>
                  </div>
                  <div className="req-card-meta">
                    <span className="type">{item.week || '未排期'}</span>
                    {isBlocked && <span className="blocked">⚠ {stats.blocked}</span>}
                    <span>{item.updatedAt || '-'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
