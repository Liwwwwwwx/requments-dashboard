'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input, Layout, Spin } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
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

  const total = (data.items || []).length;

  const handleProjectChange = (next: string) => {
    router.push(`/p/${next}`);
  };

  return (
    <Layout className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-brand">
            Trace<span className="accent">Board</span>
          </div>
        </div>

        <div className="toolbar-right">
          {!reqId && (
            <Input
              className="toolbar-search"
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder={`Search ${total} issues`}
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              allowClear
              style={{ width: 220, height: 32, borderRadius: 6 }}
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void refresh()}
            type="text"
            size="small"
            style={{ color: 'var(--text-tertiary)', fontSize: 13 }}
          />
          {user && (
            <div className="toolbar-user">
              <span className="toolbar-user-name">{user.displayName || user.username}</span>
              <Button
                size="small"
                icon={<span style={{ fontSize: 14, lineHeight: 1 }}>↪</span>}
                onClick={() => void logout()}
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 12 }}
              >
                Log out
              </Button>
            </div>
          )}
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
