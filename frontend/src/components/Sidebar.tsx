'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { UnorderedListOutlined, FolderOutlined } from '@ant-design/icons';
import type { Project, Requirement } from '@/lib/types';

interface SidebarProps {
  projects: Project[];
  selectedItem: Requirement | null;
  onProjectChange?: (project: string) => void;
}

export function Sidebar({ projects, selectedItem, onProjectChange }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams<{ project?: string }>();
  const currentProjectId = params?.project;

  const handleProjectClick = (projectId: string) => {
    onProjectChange?.(projectId);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span>工作区</span>
          </div>
          <nav className="sidebar-nav">
            <button
              type="button"
              className="sidebar-nav-item active"
            >
              <span className="icon nav-icon" style={{ background: 'var(--accent)' }}>
                <UnorderedListOutlined />
              </span>
              <span className="label">需求看板</span>
            </button>
          </nav>
        </section>

        <section className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span>项目</span>
          </div>
          <nav className="sidebar-nav">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sidebar-nav-item ${currentProjectId === p.id ? 'active' : ''}`}
                onClick={() => handleProjectClick(p.id)}
              >
                <FolderOutlined className="sidebar-project-icon" />
                <span className="label">{p.name}</span>
              </button>
            ))}
          </nav>
        </section>

        {pathname && (
          <section className="sidebar-section">
            <div className="sidebar-eyebrow">
              <span>关于</span>
            </div>
            <nav className="sidebar-nav">
              <Link
                href="/"
                className="sidebar-nav-item"
                style={{ textDecoration: 'none' }}
              >
                <span className="label">首页</span>
              </Link>
            </nav>
          </section>
        )}
      </div>

      {selectedItem && (
        <div className="sidebar-current">
          <div className="sidebar-current-eyebrow">正在查看</div>
          <div className="sidebar-current-title">{selectedItem.title}</div>
          <div className="sidebar-current-meta">
            <span>{selectedItem.id}</span>
            <span>·</span>
            <span>{selectedItem.owner || '未分配'}</span>
          </div>
        </div>
      )}
    </aside>
  );
}