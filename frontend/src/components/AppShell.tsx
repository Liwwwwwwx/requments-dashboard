'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Layout, Spin } from 'antd';
import { LogoutOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { useRequirements } from '@/hooks/useRequirements';
import { useAuth } from '@/components/AuthProvider';
import { fetchDashboardSummary } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { DashboardHeader } from './DashboardHeader';
import { QuickActionBar } from './QuickActionBar';
import { RequirementGrid } from './RequirementGrid';
import { RequirementDetailView } from './RequirementDetailView';
import type { DashboardSummary, Filters, Requirement } from '@/lib/types';

const { Content } = Layout;

const DEFAULT_FILTERS: Filters = {
  query: '',
  type: 'all',
  role: 'all',
  status: 'all',
  priority: 'all',
  week: 'all'
};

const DEFAULT_PROJECT = 'default';

interface Props {
  project?: string;
  reqId?: string;
  children?: ReactNode;
}

export function AppShell({ project, reqId, children }: Props) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { projects, data, taskItems, loading, error, refresh } = useRequirements({ project });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const activeProject = project || DEFAULT_PROJECT;

  const loadDashboard = useCallback(async () => {
    if (!activeProject) return;
    setDashLoading(true);
    try {
      const summary = await fetchDashboardSummary(activeProject);
      setDashSummary(summary);
    } catch {
      // silently fail
    } finally {
      setDashLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (!project || !projects.find((p) => p.id === project)) {
      router.replace(`/p/${projects[0].id}`, { scroll: false });
    }
  }, [projects, project, router]);

  const selectedItem: Requirement | null = useMemo(() => {
    if (!reqId) return null;
    return data.items.find((i) => i.id === reqId) || null;
  }, [data.items, reqId]);

  const items = data.items || [];
  const total = items.length;
  const doing = items.filter((i) => i.status === 'doing').length;
  const todo = items.filter((i) => i.status === 'todo').length;
  const paused = items.filter((i) => i.status === 'paused').length;
  const done = items.filter((i) => i.status === 'done').length;
  const blocked = items.reduce((acc, item) => acc + (item.taskStats?.blocked || 0), 0);
  const currentProject = projects.find((p) => p.id === project);

  const currentWeek = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }, []);

  const handleProjectChange = (next: string) => {
    router.push(`/p/${next}`);
  };

  const handleRefresh = () => {
    void refresh();
    void loadDashboard();
  };

  return (
    <Layout className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-brand">
            <span className="dot" />
            Trace<span className="accent">Board</span>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-project">
            <span className="toolbar-project-label">项目</span>
            <span className="toolbar-project-name">
              {currentProject?.name || activeProject}
            </span>
          </div>
          <div className="toolbar-divider" />
          <span className="toolbar-week">{currentWeek}</span>
          {selectedItem && (
            <>
              <div className="toolbar-divider" />
              <span
                className="toolbar-week"
                style={{ color: 'var(--text-primary)', fontWeight: 500 }}
              >
                / {selectedItem.id}
              </span>
            </>
          )}
        </div>

        <div className="toolbar-right">
          <div className="toolbar-stats">
            <div className="toolbar-stat">
              <span className="dot" style={{ background: 'var(--text-tertiary)' }} />
              <span>全部</span>
              <strong>{total}</strong>
            </div>
            <div className="toolbar-stat">
              <span className="dot" style={{ background: 'var(--status-doing-dot)' }} />
              <span>进行中</span>
              <strong>{doing}</strong>
            </div>
            <div className="toolbar-stat">
              <span className="dot" style={{ background: 'var(--status-todo-dot)' }} />
              <span>待开始</span>
              <strong>{todo}</strong>
            </div>
            <div className="toolbar-stat">
              <span className="dot" style={{ background: 'var(--status-paused-dot)' }} />
              <span>暂停</span>
              <strong>{paused}</strong>
            </div>
            <div className="toolbar-stat">
              <span className="dot" style={{ background: 'var(--status-done-dot)' }} />
              <span>完成</span>
              <strong>{done}</strong>
            </div>
            <div className={`toolbar-stat ${blocked > 0 ? 'is-blocked' : ''}`}>
              <span className="dot" style={{ background: 'var(--status-blocked-dot)' }} />
              <span>阻塞</span>
              <strong>{blocked}</strong>
            </div>
          </div>
          <div className="toolbar-divider" />
          {user && (
            <div className="toolbar-user">
              <UserOutlined style={{ color: 'var(--text-tertiary)', fontSize: 13 }} />
              <span className="toolbar-user-name">
                {user.displayName || user.username}
              </span>
              <Button
                size="small"
                icon={<LogoutOutlined />}
                onClick={() => void logout()}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-tertiary)',
                  fontSize: 12
                }}
              >
                退出
              </Button>
            </div>
          )}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={handleRefresh}
            type="primary"
            size="middle"
          >
            刷新
          </Button>
        </div>
      </header>

      <div className="layout">
        <Sidebar
          projects={projects}
          selectedItem={selectedItem}
          onProjectChange={handleProjectChange}
        />

        <Content className="main">
          {error && (
            <Alert message={error} type="error" showIcon style={{ margin: 24 }} />
          )}
          {children
            ? children
            : reqId
              ? (
                <Spin spinning={loading}>
                  <RequirementDetailView
                    item={selectedItem}
                    project={activeProject}
                    taskItems={taskItems}
                  />
                </Spin>
              )
              : (
                <div className="dashboard-view">
                  <DashboardHeader
                    summary={dashSummary}
                    loading={dashLoading}
                    currentProject={activeProject}
                  />
                  <QuickActionBar
                    filters={filters}
                    setFilters={setFilters}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    totalCount={total}
                  />
                  <Spin spinning={loading}>
                    <RequirementGrid
                      data={data}
                      project={activeProject}
                      filters={filters}
                      setFilters={setFilters}
                      selectedId={selectedItem?.id || null}
                      viewMode={viewMode}
                    />
                  </Spin>
                </div>
              )}
        </Content>
      </div>
    </Layout>
  );
}
