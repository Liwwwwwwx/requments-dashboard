'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Layout, Spin } from 'antd';
import { useRequirements } from '@/hooks/useRequirements';
import { createProject, fetchRequirement } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { TopBar } from './shell/TopBar';
import { RequirementGrid } from './RequirementGrid';
import { RequirementDetailView } from './RequirementDetailView';
import { AiAssistantWidget } from './ai/AiAssistantWidget';
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
  projectListRefreshKey?: number;
  assistantOpenOnLoad?: boolean;
  assistantRequirementId?: string;
}

export function AppShell({
  project,
  reqId,
  children,
  projectListRefreshKey,
  assistantOpenOnLoad = false,
  assistantRequirementId
}: Props) {
  const router = useRouter();
  const { projects, data, loading, error, refresh, loadProjects } = useRequirements({ project });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(assistantOpenOnLoad);
  const [detailItem, setDetailItem] = useState<Requirement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const lastProjectListRefreshKey = useRef(projectListRefreshKey);

  const activeProject = project || 'default';

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (!project || !projects.find((p) => p.id === project)) {
      router.replace(`/p/${projects[0].id}`, { scroll: false });
    }
  }, [projects, project, router]);

  useEffect(() => {
    if (projectListRefreshKey === undefined) return;
    if (lastProjectListRefreshKey.current === projectListRefreshKey) return;
    lastProjectListRefreshKey.current = projectListRefreshKey;
    void loadProjects();
  }, [loadProjects, projectListRefreshKey]);

  // Cmd/Ctrl + K：打开当前项目的悬浮 AI 助手
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setAiAssistantOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const listedItem: Requirement | null = useMemo(() => {
    if (!reqId) return null;
    return data.items.find((i) => i.id === reqId) || null;
  }, [data.items, reqId]);
  const selectedItem = listedItem || detailItem;

  useEffect(() => {
    let active = true;

    if (!reqId || listedItem) {
      setDetailItem(null);
      setDetailError(null);
      setDetailLoading(false);
      return () => {
        active = false;
      };
    }

    setDetailLoading(true);
    setDetailError(null);
    fetchRequirement(activeProject, reqId)
      .then((res) => {
        if (active) setDetailItem(res.requirement);
      })
      .catch((err) => {
        if (!active) return;
        setDetailItem(null);
        setDetailError(err instanceof Error ? err.message : '加载需求详情失败');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeProject, listedItem, reqId]);

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
      <TopBar />

      <div className="layout">
        <Sidebar
          selectedItem={selectedItem}
          assistantOpen={aiAssistantOpen}
          onToggleAssistant={() => setAiAssistantOpen((open) => !open)}
          onProjectCreate={handleProjectCreate}
          createOpen={projectCreateOpen}
          onCreateOpenChange={setProjectCreateOpen}
        />
        <Content className="main">
          {error && <Alert message={error} type="error" showIcon style={{ margin: 24 }} />}
          {detailError && <Alert message={detailError} type="error" showIcon style={{ margin: 24 }} />}
          {hasNoProjects
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
            : children
              ? children
            : reqId
              ? (
                <Spin spinning={loading || detailLoading}>
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
                  projects={projects}
                  filters={filters}
                  onFiltersChange={setFilters}
                  selectedId={selectedItem?.id || null}
                  loading={loading}
                  onCreated={refresh}
                  onProjectChange={handleProjectChange}
                  onProjectCreateRequested={() => setProjectCreateOpen(true)}
                />
              )}
        </Content>
      </div>
      {!hasNoProjects && (
        <AiAssistantWidget
          project={activeProject}
          requirementId={assistantRequirementId || reqId}
          open={aiAssistantOpen}
          onOpenChange={setAiAssistantOpen}
          key={`${activeProject}:${assistantRequirementId || reqId || 'project'}`}
        />
      )}
    </Layout>
  );
}
