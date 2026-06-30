'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { priorityBarClass } from '@/lib/utils';
import type { BoardState, Filters, RequirementStatus } from '@/lib/types';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  selectedId: string | null;
}

const COLS: { key: RequirementStatus; label: string; color: string }[] = [
  { key: 'todo', label: '待开始', color: 'var(--status-todo-dot)' },
  { key: 'doing', label: '进行中', color: 'var(--status-doing-dot)' },
  { key: 'paused', label: '暂停', color: 'var(--status-paused-dot)' },
  { key: 'done', label: '完成', color: 'var(--status-done-dot)' },
];

export function RequirementGrid({ data, project, filters, selectedId }: Props) {
  const router = useRouter();

  const query = filters.query.toLowerCase();
  const items = useMemo(() => {
    return data.items.filter((item) => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (query && !item.title.toLowerCase().includes(query) && !item.id.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [data.items, filters.status, query]);

  const cols = useMemo(() => {
    return COLS.map((col) => ({
      ...col,
      items: items.filter((i) => i.status === col.key),
    }));
  }, [items]);

  return (
    <div className="kanban">
      {cols.map((col) => (
        <div key={col.key} className="kanban-col">
          <div className="kanban-col-head">
            <span className="kanban-col-dot" style={{ background: col.color }} />
            <span className="kanban-col-name">{col.label}</span>
            <span className="kanban-col-count">{col.items.length}</span>
          </div>
          <div className="kanban-col-body">
            {col.items.map((item) => (
              <div
                key={item.id}
                className={`kanban-card ${priorityBarClass(item.priority)} ${selectedId === item.id ? 'active' : ''}`}
                onClick={() => router.push(`/p/${project}/r/${item.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/p/${project}/r/${item.id}`); } }}
              >
                <div className="kanban-card-title">{item.title}</div>
                <div className="kanban-card-foot">
                  <span className="kanban-card-id">{item.id}</span>
                  {(item.taskStats?.blocked || 0) > 0 && <span className="kanban-card-blocked">{(item.taskStats?.blocked || 0)}</span>}
                </div>
              </div>
            ))}
            {col.items.length === 0 && <div className="kanban-col-empty">—</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
