'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import type { Project, Requirement } from '@/lib/types';
import { MODULE_NAV } from '@/lib/nav';

interface SidebarProps {
  projects: Project[];
  selectedItem: Requirement | null;
  onProjectChange?: (project: string) => void;
}

export function Sidebar({ projects, selectedItem, onProjectChange }: SidebarProps) {
  const params = useParams<{ project?: string }>();
  const pathname = usePathname() || '';
  const router = useRouter();
  const currentProjectId = params?.project || 'default';

  return (
    <aside className="sidenav">
      <div className="sidenav-scroll">
        <section className="sidenav-section">
          <div className="sidenav-eyebrow">项目</div>
          <nav className="sidenav-list">
            {projects.map((p) => {
              const active = currentProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`sidenav-item ${active ? 'is-active' : ''}`}
                  onClick={() => onProjectChange?.(p.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={`sidenav-dot ${active ? 'is-active' : ''}`} />
                  <span className="sidenav-item-label">{p.name}</span>
                </button>
              );
            })}
            {projects.length === 0 && <div className="sidenav-empty">暂无项目</div>}
          </nav>
        </section>

        <section className="sidenav-section">
          <div className="sidenav-eyebrow">模块</div>
          <nav className="sidenav-list">
            {MODULE_NAV.map((mod) => {
              const Icon = mod.icon;
              const active = mod.match(pathname, currentProjectId);
              const soon = mod.status === 'soon';
              return (
                <button
                  key={mod.key}
                  type="button"
                  className={`sidenav-item ${active ? 'is-active' : ''} ${soon ? 'is-soon' : ''}`}
                  disabled={soon}
                  onClick={() => !soon && router.push(mod.path(currentProjectId))}
                  aria-current={active ? 'page' : undefined}
                  title={soon ? `${mod.label}（即将上线）` : mod.label}
                >
                  <Icon className="sidenav-item-icon" />
                  <span className="sidenav-item-label">{mod.label}</span>
                  {soon && <span className="sidenav-soon">Soon</span>}
                </button>
              );
            })}
          </nav>
        </section>
      </div>

      {selectedItem && (
        <div className="sidenav-current">
          <div className="sidenav-current-eyebrow">当前查看</div>
          <div className="sidenav-current-title">{selectedItem.title}</div>
          <div className="sidenav-current-meta">
            <span className="mono">{selectedItem.id}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
