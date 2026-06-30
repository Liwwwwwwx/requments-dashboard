'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AimOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  ExclamationOutlined,
} from '@ant-design/icons';
import type { BoardState, Filters, RequirementStatus } from '@/lib/types';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  selectedId: string | null;
}

const COLS: { key: RequirementStatus; label: string; icon: typeof CheckOutlined }[] = [
  { key: 'todo', label: 'Backlog', icon: ClockCircleOutlined },
  { key: 'doing', label: 'In Progress', icon: AimOutlined },
  { key: 'paused', label: 'Paused', icon: ExclamationOutlined },
  { key: 'done', label: 'Done', icon: CheckOutlined },
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
    <div className="board">
      {cols.map((col) => {
        const Icon = col.icon;
        return (
          <section key={col.key} className="board-col">
            <header className="board-col-header">
              <Icon className="board-col-icon" />
              <span className="board-col-label">{col.label}</span>
              <span className="board-col-count">{col.items.length}</span>
            </header>
            <div className="board-col-items">
              {col.items.map((item) => (
                <article
                  key={item.id}
                  className={`board-item ${selectedId === item.id ? 'is-active' : ''}`}
                  onClick={() => router.push(`/p/${project}/r/${item.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/p/${project}/r/${item.id}`);
                    }
                  }}
                >
                  <h4 className="board-item-title">{item.title}</h4>
                  <footer className="board-item-meta">
                    <span className="board-item-key">{item.id}</span>
                    {(item.taskStats?.blocked || 0) > 0 && (
                      <span className="board-item-badge board-item-badge--danger">
                        ⚠ {item.taskStats.blocked}
                      </span>
                    )}
                    {(item.taskStats?.active || 0) > 0 && (
                      <span className="board-item-badge">{item.taskStats.active}</span>
                    )}
                  </footer>
                </article>
              ))}
              {col.items.length === 0 && (
                <div className="board-col-empty">No issues</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
