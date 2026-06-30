'use client';

import { useMemo } from 'react';
import { Empty } from 'antd';
import { useRouter } from 'next/navigation';
import {
  priorityBarClass,
  priorityChipClass,
  statusChipClass,
  statusLabel,
  unique
} from '@/lib/utils';
import type { BoardState, Filters, RequirementStatus } from '@/lib/types';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  selectedId: string | null;
  viewMode: 'grid' | 'list';
}

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
      return true;
    });
  }, [data.items, filters.week, filters.status]);

  const { pendingItems, doneItems } = useMemo(() => {
    if (filters.status !== 'all') {
      return { pendingItems: filteredItems, doneItems: [] };
    }
    const pending: typeof filteredItems = [];
    const done: typeof filteredItems = [];
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

  const goDetail = (reqId: string) => {
    router.push(`/p/${project}/r/${reqId}`);
  };

  const renderCard = (item: BoardState['items'][number], isDone = false) => {
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
          isDone ? 'is-done' : ''
        ]
          .join(' ')
          .trim()}
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
            <span className="count">
              {stats.done || 0}/{stats.total || 0}
            </span>
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
      <div className="view-list-meta" style={{ marginBottom: 12 }}>
        <span>共 {filteredItems.length} 条需求</span>
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

      {filteredItems.length === 0 ? (
        <Empty description="暂无任务" />
      ) : (
        <>
          {pendingItems.length > 0 && (
            <div className={viewMode === 'grid' ? 'req-grid' : 'req-list'}>
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
              <div className={viewMode === 'grid' ? 'req-grid' : 'req-list'}>
                {doneItems.map((item) => renderCard(item, true))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}