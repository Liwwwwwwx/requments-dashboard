'use client';

import { useMemo } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Priority, Requirement, RequirementStatus } from '@/lib/types';

interface Props {
  items: Requirement[];
  selectedId: string | null;
  isInitialLoading: boolean;
  onOpen: (id: string) => void;
}

const COLS: { key: RequirementStatus; label: string; tone: string }[] = [
  { key: 'todo', label: '待开始', tone: 'todo' },
  { key: 'doing', label: '进行中', tone: 'doing' },
  { key: 'blocked', label: '阻塞', tone: 'blocked' },
  { key: 'done', label: '完成', tone: 'done' }
];

const PRIORITY_TONE: Record<string, string> = { P0: 'p0', P1: 'p1', P2: 'p2' };
function prioTone(priority: Priority | string): string {
  return PRIORITY_TONE[priority] || 'p3';
}

const cardMarkdownComponents: Components = {
  h1: ({ children }) => <span>{children} </span>,
  h2: ({ children }) => <span>{children} </span>,
  h3: ({ children }) => <span>{children} </span>,
  h4: ({ children }) => <span>{children} </span>,
  p: ({ children }) => <span>{children} </span>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span className="card-markdown-list-item">• {children} </span>,
  pre: ({ children }) => <span>{children}</span>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
      {children}
    </a>
  ),
  table: ({ children }) => <span>{children}</span>,
  thead: ({ children }) => <span>{children}</span>,
  tbody: ({ children }) => <span>{children}</span>,
  tr: ({ children }) => <span>{children} </span>,
  th: ({ children }) => <span>{children} </span>,
  td: ({ children }) => <span>{children} </span>
};

export function BoardColumns({ items, selectedId, isInitialLoading, onOpen }: Props) {
  const cols = useMemo(
    () => COLS.map((col) => ({ ...col, items: items.filter((i) => i.status === col.key) })),
    [items]
  );

  return (
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
                  return (
                    <article
                      key={item.id}
                      className={`card ${selectedId === item.id ? 'is-active' : ''}`}
                      onClick={() => onOpen(item.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpen(item.id);
                        }
                      }}
                    >
                      <h4 className="card-title">{item.title}</h4>
                      {item.summary && (
                        <div className="card-summary card-markdown-summary">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={cardMarkdownComponents}
                          >
                            {item.summary}
                          </ReactMarkdown>
                        </div>
                      )}
                      <footer className="card-meta">
                        <span className={`card-prio tone-${prioTone(item.priority)}`}>
                          {item.priority || 'P3'}
                        </span>
                        <span className="card-id">{item.id}</span>
                        <span className="card-owner">{item.owner || '未分配'}</span>
                        {item.updatedAt && <span className="card-updated">{item.updatedAt}</span>}
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
  );
}
