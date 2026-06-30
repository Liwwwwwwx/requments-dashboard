'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  priorityBarClass,
  priorityChipClass,
  unique
} from '@/lib/utils';
import type { BoardState, Filters, Requirement, RequirementStatus } from '@/lib/types';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  selectedId: string | null;
}

interface KanbanColumn {
  key: RequirementStatus;
  label: string;
  color: string;
  bg: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { key: 'todo', label: '待开始', color: 'var(--status-todo-dot)', bg: 'var(--status-todo-bg)' },
  { key: 'doing', label: '进行中', color: 'var(--status-doing-dot)', bg: 'var(--status-doing-bg)' },
  { key: 'paused', label: '暂停', color: 'var(--status-paused-dot)', bg: 'var(--status-paused-bg)' },
  { key: 'done', label: '完成', color: 'var(--status-done-dot)', bg: 'var(--status-done-bg)' },
];

const STATUS_TABS: { key: 'all' | RequirementStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'todo', label: '待开始' },
  { key: 'doing', label: '进行中' },
  { key: 'paused', label: '暂停' },
  { key: 'done', label: '完成' }
];

export function RequirementGrid({ data, project, filters, setFilters, selectedId }: Props) {
  const router = useRouter();

  const weeks = useMemo(() => unique(data.items.map((i) => i.week)).reverse(), [data.items]);

  const filteredItems = useMemo(() => {
    return data.items.filter((item) => {
      if (filters.week !== 'all' && item.week !== filters.week) return false;
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data.items, filters.week, filters.status, filters.query]);

  const kanbanColumns = useMemo(() => {
    const columns = KANBAN_COLUMNS.map((col) => ({
      ...col,
      items: filteredItems.filter((item) => item.status === col.key),
    }));

    if (filters.status !== 'all') {
      return columns.filter((col) => col.key === filters.status);
    }
    return columns;
  }, [filteredItems, filters.status]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, todo: 0, doing: 0, paused: 0, done: 0 };
    for (const item of data.items) {
      if (filters.week !== 'all' && item.week !== filters.week) continue;
      counts.all += 1;
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }, [data.items, filters.week]);

  const goDetail = (reqId: string) => {
    router.push(`/p/${project}/r/${reqId}`);
  };

  const renderCard = (item: Requirement, isDone = false) => {
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        className={[
          'req-card',
          'compact',
          priorityBarClass(item.priority),
          selectedId === item.id ? 'active' : '',
          isDone ? 'is-done' : ''
        ].join(' ').trim()}
        onClick={() => goDetail(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goDetail(item.id);
          }
        }}
      >
        <div className="req-card-head">
          <span className="req-card-id">{item.id}</span>
          {item.priority && (
            <span className={`chip chip-sm ${priorityChipClass(item.priority)}`}>
              <span className="chip-dot" />
              {item.priority}
            </span>
          )}
        </div>

        <div className="req-card-title">{item.title}</div>

        {item.summary && (
          <div className="req-card-summary">{item.summary}</div>
        )}

        <div className="req-card-chips">
          {item.type && item.type !== '工程' && <span className="chip chip-sm">{item.type}</span>}
          {(item.taskStats?.blocked || 0) > 0 && (
            <span className="chip chip-sm chip-warn">⚠ {item.taskStats.blocked}</span>
          )}
          {(item.taskStats?.active || 0) > 0 && (
            <span className="chip chip-sm chip-active">{item.taskStats.active} 活跃</span>
          )}
        </div>

        <div className="req-card-foot">
          <div className="req-card-progress">
            <div className={(item.taskStats?.blocked || 0) > 0 ? 'bar is-blocked' : 'bar'}>
              <span style={{ width: `${item.taskStats?.total ? Math.round((item.taskStats.done / item.taskStats.total) * 100) : 0}%` }} />
            </div>
            <span className="count">
              {item.taskStats?.done || 0}/{item.taskStats?.total || 0}
            </span>
          </div>
          <div className="req-card-meta">
            <span className="owner">{item.owner?.split('/')?.pop()?.trim() || '-'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="view-list">
      <div className="view-list-meta">
        <span className="view-list-count">
          共 <strong>{filteredItems.length}</strong> 条需求
        </span>
      </div>

      <div className="filter-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`week-tab ${filters.status === tab.key ? 'active' : ''}`}
            onClick={() => setFilters((prev) => ({ ...prev, status: tab.key }))}
          >
            {tab.label}
            <span className="tab-count">{statusCounts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {weeks.length > 0 && (
        <div className="week-tabs">
          <button
            type="button"
            className={`week-tab ${filters.week === 'all' ? 'active' : ''}`}
            onClick={() => setFilters((prev) => ({ ...prev, week: 'all' }))}
          >
            全部
          </button>
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              className={`week-tab ${filters.week === w ? 'active' : ''}`}
              onClick={() => setFilters((prev) => ({ ...prev, week: w }))}
            >
              {w}
            </button>
          ))}
        </div>
      )}

      <div className="filtered-count-row">
        {kanbanColumns.map((col) => (
          <div key={col.key} className="kanban-col-indicator">
            <span className="kanban-col-indicator-dot" style={{ background: col.color }} />
            <span className="kanban-col-indicator-label">{col.label}</span>
            <span className="kanban-col-indicator-count">{col.items.length}</span>
          </div>
        ))}
      </div>

      <div className="kanban-board" style={{ gridTemplateColumns: `repeat(${kanbanColumns.length}, 1fr)` }}>
        {kanbanColumns.map((col) => (
          <div key={col.key} className="kanban-col">
            <div className="kanban-col-head">
              <span className="kanban-col-dot" style={{ background: col.color }} />
              <span className="kanban-col-label">{col.label}</span>
              <span className="kanban-col-count">{col.items.length}</span>
            </div>
            <div className="kanban-col-body">
              {col.items.length === 0 ? (
                <div className="kanban-empty">
                  <span>暂无</span>
                </div>
              ) : (
                col.items.map((item) => renderCard(item, col.key === 'done'))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
