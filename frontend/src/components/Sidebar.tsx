'use client';

import { useParams } from 'next/navigation';
import type { Project, Requirement } from '@/lib/types';

interface SidebarProps {
  projects: Project[];
  selectedItem: Requirement | null;
  onProjectChange?: (project: string) => void;
}

export function Sidebar({ projects, selectedItem, onProjectChange }: SidebarProps) {
  const params = useParams<{ project?: string }>();
  const currentProjectId = params?.project;

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`sidebar-nav-item ${currentProjectId === p.id ? 'active' : ''}`}
              onClick={() => onProjectChange?.(p.id)}
            >
              <span className="sidebar-nav-dot" style={{ background: currentProjectId === p.id ? 'var(--accent)' : 'var(--border-strong)' }} />
              <span className="label">{p.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {selectedItem && (
        <div className="sidebar-current">
          <div className="sidebar-current-eyebrow">Viewing</div>
          <div className="sidebar-current-title">{selectedItem.title}</div>
          <div className="sidebar-current-meta">
            <span>{selectedItem.id}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
