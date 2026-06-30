'use client';

import { useMemo, useState } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import type { Requirement, RequirementStatus } from '@/lib/types';
import { priorityChipClass, statusChipClass, statusLabel } from '@/lib/utils';

interface Props {
  items: Requirement[];
  selectedId: string | null;
  isInitialLoading: boolean;
  onOpen: (id: string) => void;
}

type SortKey = 'priority' | 'title' | 'status' | 'owner' | 'week' | 'dueDate' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
const STATUS_ORDER: Record<string, number> = { todo: 0, doing: 1, paused: 2, done: 3 };

const COLUMNS: { key: SortKey; label: string; sortable: boolean; className?: string }[] = [
  { key: 'priority', label: '优先级', sortable: true, className: 'col-prio' },
  { key: 'title', label: '需求', sortable: true, className: 'col-title' },
  { key: 'status', label: '状态', sortable: true, className: 'col-status' },
  { key: 'owner', label: '负责人', sortable: true, className: 'col-owner' },
  { key: 'week', label: '周期', sortable: true, className: 'col-week' },
  { key: 'updatedAt', label: '更新', sortable: true, className: 'col-date' },
  { key: 'dueDate', label: '截止', sortable: true, className: 'col-date' }
];

function compare(a: Requirement, b: Requirement, key: SortKey): number {
  switch (key) {
    case 'priority':
      return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    case 'status':
      return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    case 'title':
      return a.title.localeCompare(b.title, 'zh');
    case 'owner':
      return (a.owner || '').localeCompare(b.owner || '', 'zh');
    case 'week':
      return (a.week || '').localeCompare(b.week || '');
    case 'dueDate':
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    case 'updatedAt':
      return (a.updatedAt || '').localeCompare(b.updatedAt || '');
    default:
      return 0;
  }
}

export function ListView({ items, selectedId, isInitialLoading, onOpen }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'updatedAt', dir: 'desc' });

  const rows = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const base = compare(a, b, sort.key);
      return sort.dir === 'asc' ? base : -base;
    });
    return sorted;
  }, [items, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  if (isInitialLoading) {
    return (
      <div className="list-wrap">
        <div className="list-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="sk-line" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="list-empty">
        <InboxOutlined className="list-empty-icon" />
        <span>没有匹配的需求</span>
      </div>
    );
  }

  return (
    <div className="list-wrap">
      <table className="list-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  className={col.className}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      className={`list-sort ${active ? 'is-active' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <span className="list-sort-arrow">
                        {active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
            <th className="col-progress">进度</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const status = statusLabel(item.status as RequirementStatus);
            const total = item.taskStats?.total || 0;
            const done = item.taskStats?.done || 0;
            const blocked = item.taskStats?.blocked || 0;
            return (
              <tr
                key={item.id}
                className={`list-row ${selectedId === item.id ? 'is-active' : ''}`}
                onClick={() => onOpen(item.id)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(item.id);
                  }
                }}
              >
                <td className="col-prio">
                  <span className={`chip ${priorityChipClass(item.priority)}`}>
                    <span className="chip-dot" />
                    {item.priority || 'P3'}
                  </span>
                </td>
                <td className="col-title">
                  <span className="list-title">{item.title}</span>
                  <span className="list-id">{item.id}</span>
                </td>
                <td className="col-status">
                  <span className={`chip ${statusChipClass(item.status)}`}>
                    <span className="chip-dot" />
                    {status.label}
                  </span>
                </td>
                <td className="col-owner">{item.owner || '—'}</td>
                <td className="col-week list-mono">{item.week || '—'}</td>
                <td className="col-date list-mono">{item.updatedAt || '—'}</td>
                <td className="col-date list-mono">{item.dueDate || '—'}</td>
                <td className="col-progress">
                  <span className="list-progress">
                    <span className="list-progress-text">
                      {done}/{total}
                    </span>
                    {blocked > 0 && <span className="list-progress-blocked">阻塞 {blocked}</span>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
