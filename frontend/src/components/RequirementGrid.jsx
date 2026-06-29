import { useMemo } from 'react';
import { Empty } from 'antd';
import {
  statusLabel,
  priorityChipClass,
  priorityBarClass,
  statusChipClass,
  unique
} from '../utils';

export function RequirementGrid({
  data,
  filters,
  setFilters,
  navFilter,
  selected,
  onSelect
}) {
  const weeks = useMemo(() => unique(data.items.map((i) => i.week)).reverse(), [data.items]);

  const filteredItems = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return data.items.filter((item) => {
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

  const { pendingItems, doneItems } = useMemo(() => {
    const pending = [];
    const done = [];
    for (const item of filteredItems) {
      if (item.status === 'done') {
        done.push(item);
      } else {
        pending.push(item);
      }
    }
    return { pendingItems: pending, doneItems: done };
  }, [filteredItems]);

  const navLabel = {
    all: '全部需求',
    doing: '进行中',
    todo: '待开始',
    paused: '暂停',
    done: '完成'
  }[navFilter] || '全部需求';

  const renderCard = (item, selected, onSelect, isDone = false) => {
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
          isActive ? 'active' : '',
          isDone ? 'is-done' : ''
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
        {isDone && <div className="req-card-done-overlay" />}
      </div>
    );
  };

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
        <>
          {pendingItems.length > 0 && (
            <div className="req-grid">
              {pendingItems.map((item) => renderCard(item, selected, onSelect))}
            </div>
          )}
          {doneItems.length > 0 && (
            <>
              {pendingItems.length > 0 && (
                <div className="req-section-divider">
                  <span className="req-section-divider-line" />
                  <span className="req-section-divider-label">已完成</span>
                  <span className="req-section-divider-count">{doneItems.length}</span>
                  <span className="req-section-divider-line" />
                </div>
              )}
              <div className="req-grid">
                {doneItems.map((item) => renderCard(item, selected, onSelect, true))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
