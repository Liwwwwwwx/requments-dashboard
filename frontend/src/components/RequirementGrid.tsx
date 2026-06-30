'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InboxOutlined } from '@ant-design/icons';
import type { BoardState, Filters, Priority, RequirementStatus } from '@/lib/types';
import { BOARD_VIEWS } from '@/lib/nav';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  selectedId: string | null;
  loading?: boolean;
}

const COLS: { key: RequirementStatus; label: string; tone: string }[] = [
  { key: 'todo', label: '待开始', tone: 'todo' },
  { key: 'doing', label: '进行中', tone: 'doing' },
  { key: 'paused', label: '暂停', tone: 'paused' },
  { key: 'done', label: '完成', tone: 'done' }
];

const PRIORITY_TONE: Record<string, string> = { P0: 'p0', P1: 'p1', P2: 'p2' };
function prioTone(priority: Priority | string): string {
  return PRIORITY_TONE[priority] || 'p3';
}

export function RequirementGrid({ data, project, filters, selectedId, loading }: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('board');

  const query = filters.query.toLowerCase();
  const items = useMemo(() => {
    return data.items.filter((item) => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (query && !item.title.toLowerCase().includes(query) && !item.id.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [data.items, filters.status, query]);

  const cols = useMemo(
    () => COLS.map((col) => ({ ...col, items: items.filter((i) => i.status === col.key) })),
    [items]
  );

  const isInitialLoading = loading && data.items.length === 0;
  const open = (id: string) => router.push(`/p/${project}/r/${id}`);

  return (
    <div className="board-wrap">
      <div className="board-toolbar">
        <div className="viewtabs" role="tablist" aria-label="视图切换">
          {BOARD_VIEWS.map((view) => {
            const Icon = view.icon;
            const active = activeView === view.key;
            const soon = view.status === 'soon';
            return (
              <button
                key={view.key}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={soon}
                className={`viewtab ${active ? 'is-active' : ''} ${soon ? 'is-soon' : ''}`}
                onClick={() => !soon && setActiveView(view.key)}
                title={soon ? `${view.label}视图（即将上线）` : `${view.label}视图`}
              >
                <Icon className="viewtab-icon" />
                <span>{view.label}</span>
                {soon && <span className="viewtab-soon">Soon</span>}
              </button>
            );
          })}
        </div>
        <div className="board-count">
          共 <strong>{items.length}</strong> 条需求
        </div>
      </div>

      <div className="board">
        {cols.map((col) => (
          <section key={col.key} className="board-col">
            <header className="board-col-header">
              <span className={`board-col-dot tone-${col.tone}`} />
              <span className="board-col-label">{col.label}</span>
              <span className="board-col-count">{col.items.length}</span>
            </header>

            <div className="board-col-body">
              {isInitialLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="card card-skeleton" aria-hidden="true">
                      <span className="sk-line sk-line-1" />
                      <span className="sk-line sk-line-2" />
                    </div>
                  ))
                : col.items.map((item) => {
                    const blocked = item.taskStats?.blocked || 0;
                    const active = item.taskStats?.active || 0;
                    return (
                      <article
                        key={item.id}
                        className={`card ${selectedId === item.id ? 'is-active' : ''}`}
                        onClick={() => open(item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            open(item.id);
                          }
                        }}
                      >
                        <h4 className="card-title">{item.title}</h4>
                        <footer className="card-meta">
                          <span className={`card-prio tone-${prioTone(item.priority)}`}>
                            {item.priority || 'P3'}
                          </span>
                          <span className="card-id">{item.id}</span>
                          <span className="card-badges">
                            {blocked > 0 && (
                              <span className="card-badge is-blocked" title={`${blocked} 个阻塞任务`}>
                                阻塞 {blocked}
                              </span>
                            )}
                            {active > 0 && (
                              <span className="card-badge" title={`${active} 个进行中任务`}>
                                进行 {active}
                              </span>
                            )}
                          </span>
                        </footer>
                      </article>
                    );
                  })}

              {!isInitialLoading && col.items.length === 0 && (
                <div className="board-col-empty">
                  <InboxOutlined className="board-col-empty-icon" />
                  <span>暂无需求</span>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
