'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input, Layout, Spin } from 'antd';
import { LogoutOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useRequirements } from '@/hooks/useRequirements';
import { useAuth } from '@/components/AuthProvider';
import { Sidebar } from './Sidebar';
import { RequirementGrid } from './RequirementGrid';
import { RequirementDetailView } from './RequirementDetailView';
import type { Filters, Requirement } from '@/lib/types';

const { Content } = Layout;

const DEFAULT_FILTERS: Filters = {
  query: '',
  type: 'all',
  role: 'all',
  status: 'all',
  priority: 'all',
  week: 'all'
};

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

  const activeProject = project || 'default';

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

  const currentProject = projects.find((p) => p.id === project);
  const total = (data.items || []).length;

  const handleProjectChange = (next: string) => {
    router.push(`/p/${next}`);
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
            <span className="toolbar-project-name">{currentProject?.name || activeProject}</span>
          </div>
        </div>

        <div className="toolbar-right">
          {!reqId && (
            <>
              <Input
                className="toolbar-search"
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                placeholder={`搜索 ${total} 条需求`}
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                allowClear
                style={{ width: 200, height: 34, borderRadius: 6 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ height: 34, borderRadius: 6, fontSize: 13, fontWeight: 500 }}
              >
                新建
              </Button>
            </>
          )}
          {user && (
            <div className="toolbar-user">
              <UserOutlined style={{ color: 'var(--text-tertiary)', fontSize: 13 }} />
              <span className="toolbar-user-name">{user.displayName || user.username}</span>
              <Button
                size="small"
                icon={<LogoutOutlined />}
                onClick={() => void logout()}
                style={{ background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)', fontSize: 12 }}
              >
                退出
              </Button>
            </div>
          )}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void refresh()}
            type="primary"
            size="middle"
          >
            刷新
          </Button>
        </div>
      </header>

      <div className="layout">
        <Sidebar projects={projects} selectedItem={selectedItem} onProjectChange={handleProjectChange} />
        <Content className="main">
          {error && <Alert message={error} type="error" showIcon style={{ margin: 24 }} />}
          {children
            ? children
            : reqId
              ? (
                <Spin spinning={loading}>
                  <RequirementDetailView item={selectedItem} project={activeProject} taskItems={taskItems} />
                </Spin>
              )
              : (
                <Spin spinning={loading}>
                  <RequirementGrid
                    data={data}
                    project={activeProject}
                    filters={filters}
                    selectedId={selectedItem?.id || null}
                  />
                </Spin>
              )}
        </Content>
      </div>
    </Layout>
  );
}
