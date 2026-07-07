'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Layout, Spin } from 'antd';
import { useRequirements } from '@/hooks/useRequirements';
import { createProject } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { TopBar } from './shell/TopBar';
import { RequirementGrid } from './RequirementGrid';
import { RequirementDetailView } from './RequirementDetailView';
import type { Filters, Requirement } from '@/lib/types';

const { Content } = Layout;

const DEFAULT_FILTERS: Filters = {
  query: '',
  status: 'all',
  priority: 'all',
  owner: 'all'
};

interface Props {
  project?: string;
  reqId?: string;
  children?: ReactNode;
}

export function AppShell({ project, reqId, children }: Props) {
  const router = useRouter();
  const { projects, data, loading, error, refresh, loadProjects } = useRequirements({ project });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);

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
  const hasNoProjects = !loading && projects.length === 0;

  const handleProjectChange = (next: string) => {
    router.push(`/p/${next}`);
  };

  const handleProjectCreate = async (input: { id: string; name?: string; description?: string }) => {
    const res = await createProject(input.id, {
      name: input.name,
      description: input.description
    });
    await loadProjects();
    router.push(`/p/${res.project.id}`);
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
        <Sidebar
          projects={projects}
          selectedItem={selectedItem}
          onProjectChange={handleProjectChange}
          onProjectCreate={handleProjectCreate}
          createOpen={projectCreateOpen}
          onCreateOpenChange={setProjectCreateOpen}
        />
        <Content className="main">
          {error && <Alert message={error} type="error" showIcon style={{ margin: 24 }} />}
          {children
            ? children
            : hasNoProjects
              ? (
                <div className="first-project-empty">
                  <div className="first-project-empty-inner">
                    <div className="first-project-empty-kicker">项目</div>
                    <h2>还没有项目</h2>
                    <p>先创建一个项目，之后需求看板、需求详情和 AI 小助手都会围绕当前项目工作。</p>
                    <Button type="primary" onClick={() => setProjectCreateOpen(true)}>
                      创建项目
                    </Button>
                  </div>
                </div>
              )
            : reqId
              ? (
                <Spin spinning={loading}>
                  <RequirementDetailView
                    item={selectedItem}
                    project={activeProject}
                    onUpdated={refresh}
                  />
                </Spin>
              )
              : (
                <RequirementGrid
                  data={data}
                  project={activeProject}
                  filters={filters}
                  onFiltersChange={setFilters}
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
