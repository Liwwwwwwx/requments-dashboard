'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BoardState, Filters } from '@/lib/types';
import { BOARD_VIEWS } from '@/lib/nav';
import { BoardColumns } from './board/BoardColumns';
import { ListView } from './board/ListView';
import { TimelineView } from './board/TimelineView';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  selectedId: string | null;
  loading?: boolean;
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

  const isInitialLoading = !!loading && data.items.length === 0;
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
        {activeView !== 'timeline' && (
          <div className="board-count">
            共 <strong>{items.length}</strong> 条需求
          </div>
        )}
      </div>

      {activeView === 'board' && (
        <BoardColumns
          items={items}
          selectedId={selectedId}
          isInitialLoading={isInitialLoading}
          onOpen={open}
        />
      )}
      {activeView === 'list' && (
        <ListView
          items={items}
          selectedId={selectedId}
          isInitialLoading={isInitialLoading}
          onOpen={open}
        />
      )}
      {activeView === 'timeline' && (
        <TimelineView project={project} requirements={data.items} onOpen={open} />
      )}
    </div>
  );
}
