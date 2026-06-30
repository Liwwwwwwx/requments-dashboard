'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  priorityBarClass,
  priorityChipClass,
  statusChipClass,
  statusLabel,
  unique
} from '@/lib/utils';
import type { BoardState, Filters, Requirement, RequirementStatus } from '@/lib/types';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  selectedId: string | null;
  viewMode: 'kanban' | 'grid' | 'list';
}

interface Column {
  key: RequirementStatus;
  label: string;
  color: string;
  bg: string;
  count: number;
}

const KANBAN_COLUMNS: Column[] = [
  { key: 'todo', label: '待开始', color: 'var(--status-todo-dot)', bg: 'var(--status-todo-bg)', count: 0 },
  { key: 'doing', label: '进行中', color: 'var(--status-doing-dot)', bg: 'var(--status-doing-bg)', count: 0 },
  { key: 'paused', label: '暂停', color: 'var(--status-paused-dot)', bg: 'var(--status-paused-bg)', count: 0 },
  { key: 'done', label: '完成', color: 'var(--status-done-dot)', bg: 'var(--status-done-bg)', count: 0 },
];

const STATUS_TABS: { key: 'all' | RequirementStatus; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'todo', label: '待开始' },
  { key: 'doing', label: '进行中' },
  { key: 'paused', label: '暂停' },
  { key: 'done', label: '完成' }
];

export function RequirementGrid({ data, project, filters, setFilters, selectedId, viewMode }: Props) {
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

  const { pendingItems, doneItems } = useMemo(() => {
    if (filters.status !== 'all') {
      return { pendingItems: filteredItems, doneItems: [] };
    }
    const pending: Requirement[] = [];
    const done: Requirement[] = [];
    for (const item of filteredItems) {
      if (item.status === 'done') done.push(item);
      else pending.push(item);
    }
    return { pendingItems: pending, doneItems: done };
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

  const kanbanColumns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      items: filteredItems.filter((item) => item.status === col.key),
      count: filteredItems.filter((item) => item.status === col.key).length,
    }));
  }, [filteredItems]);

  const goDetail = (reqId: string) => {
    router.push(`/p/${project}/r/${reqId}`);
  };

  const renderCard = (item: Requirement, isDone = false, compact = false) => {
    const stats = item.taskStats || { total: 0, done: 0, blocked: 0 };
    const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    const status = statusLabel(item.status);
    const isActive = selectedId === item.id;
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
          isDone ? 'is-done' : '',
          compact ? 'compact' : ''
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

        {item.summary && !compact && (
          <div className="req-card-summary">{item.summary}</div>
        )}

        <div className="req-card-chips">
          <span className={`chip chip-sm ${statusChipClass(item.status)}`}>
            <span className="chip-dot" />
            {status.label}
          </span>
          {item.type && <span className="chip chip-sm">{item.type}</span>}
          {isBlocked && <span className="chip chip-sm chip-warn">⚠ {stats.blocked}</span>}
        </div>

        <div className="req-card-foot">
          <div className="req-card-progress">
            <div className={isBlocked ? 'bar is-blocked' : 'bar'}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <span className="count">
              {stats.done || 0}/{stats.total || 0}
            </span>
          </div>
          <div className="req-card-meta">
            <span className="type">{item.week || '未排期'}</span>
            <span className="owner">{item.owner?.split('/')?.pop()?.trim() || '-'}</span>
          </div>
        </div>
        {isDone && <div className="req-card-done-overlay" />}
      </div>
    );
  };

  const renderFilters = () => (
    <>
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
    </>
  );

  const renderKanban = () => (
    <div className="kanban-board">
      {kanbanColumns.map((col) => (
        <div key={col.key} className="kanban-col">
          <div className="kanban-col-head">
            <span className="kanban-col-dot" style={{ background: col.color }} />
            <span className="kanban-col-label">{col.label}</span>
            <span className="kanban-col-count">{col.count}</span>
          </div>
          <div className="kanban-col-body">
            {col.items.length === 0 ? (
              <div className="kanban-empty">
                <span>暂无</span>
              </div>
            ) : (
              col.items.map((item) => renderCard(item, col.key === 'done', true))
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderGrid = () => (
    <>
      {filteredItems.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">📋</div>
          <p>暂无匹配的需求</p>
          <span>试试调整过滤条件或新建一个需求</span>
        </div>
      ) : (
        <>
          {pendingItems.length > 0 && (
            <div className="req-grid">
              {pendingItems.map((item) => renderCard(item))}
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
                {doneItems.map((item) => renderCard(item, true))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );

  const renderList = () => (
    <>
      {filteredItems.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">📋</div>
          <p>暂无匹配的需求</p>
        </div>
      ) : (
        <div className="req-list">
          {filteredItems.map((item) => renderCard(item, item.status === 'done', false))}
        </div>
      )}
    </>
  );

  return (
    <div className="view-list">
      <div className="view-list-meta">
        <span className="view-list-count">
          共 <strong>{filteredItems.length}</strong> 条需求
        </span>
      </div>

      {viewMode !== 'kanban' && renderFilters()}
      {viewMode === 'kanban' ? renderKanban() : viewMode === 'list' ? renderList() : renderGrid()}
    </div>
  );
}
