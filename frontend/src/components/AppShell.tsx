'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Layout, Spin } from 'antd';
import { useRequirements } from '@/hooks/useRequirements';
import { Sidebar } from './Sidebar';
import { TopBar } from './shell/TopBar';
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
  const { projects, data, taskItems, loading, error, refresh } = useRequirements({ project });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const activeProject = project || 'default';

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (!project || !projects.find((p) => p.id === project)) {
      router.replace(`/p/${projects[0].id}`, { scroll: false });
    }
  }, [projects, project, router]);

  // Cmd/Ctrl + K：跳到当前项目的 AI 小助手
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        router.push(`/p/${activeProject}/ai`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeProject, router]);

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
      <TopBar
        total={total}
        showSearch={!reqId}
        query={filters.query}
        onQueryChange={(query) => setFilters((f) => ({ ...f, query }))}
        loading={loading}
        onRefresh={() => void refresh()}
        projectId={activeProject}
      />

      <div className="layout">
        <Sidebar projects={projects} selectedItem={selectedItem} onProjectChange={handleProjectChange} />
        <Content className="main">
          {error && <Alert message={error} type="error" showIcon style={{ margin: 24 }} />}
          {children
            ? children
            : reqId
              ? (
                <Spin spinning={loading}>
                  <RequirementDetailView
                    item={selectedItem}
                    project={activeProject}
                    taskItems={taskItems}
                    onUpdated={refresh}
                  />
                </Spin>
              )
              : (
                <RequirementGrid
                  data={data}
                  project={activeProject}
                  filters={filters}
                  selectedId={selectedItem?.id || null}
                  loading={loading}
                  onCreated={refresh}
                />
              )}
        </Content>
      </div>
    </Layout>
  );
}
