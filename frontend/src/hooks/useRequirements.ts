'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchState, listProjects, renderState, ApiError } from '@/lib/api';
import type { BoardState, Project } from '@/lib/types';

interface UseRequirementsResult {
  project: string;
  projects: Project[];
  data: BoardState;
  taskItems: (BoardState['items'][number]['tasks'][number] & {
    taskKey: string;
    requirementId: string;
    requirementTitle: string;
    requirementType: string;
    requirementWeek: string;
    requirementPriority: string;
    requirementOwner: string;
    requirementStatus: string;
    requirementWorkflowStatus: string;
    requirementUpdatedAt: string;
    requirementSummary: string;
    requirement: BoardState['items'][number];
  })[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadState: () => Promise<void>;
  loadProjects: () => Promise<void>;
}

const EMPTY_STATE: BoardState = { updatedAt: '', statuses: [], items: [] };

export function useRequirements({
  project,
  fallbackProject = 'default'
}: {
  project?: string;
  fallbackProject?: string;
} = {}): UseRequirementsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [data, setData] = useState<BoardState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProject = project || fallbackProject;

  const loadProjects = useCallback(async () => {
    try {
      const res = await listProjects();
      setProjects(res.projects || []);
    } catch (e) {
      // ignore project list errors
      console.warn('loadProjects failed', e);
    }
  }, []);

  const loadState = useCallback(
    async (targetProject: string = activeProject) => {
      if (!targetProject) return;
      setLoading(true);
      setError(null);
      try {
        const state = await fetchState(targetProject);
        setData(state);
      } catch (e) {
        if (e instanceof ApiError && e.message === 'PROJECT_NOT_FOUND') {
          setData(EMPTY_STATE);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [activeProject]
  );

  const refresh = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    setError(null);
    try {
      await renderState(activeProject);
      const state = await fetchState(activeProject);
      setData(state);
    } catch (e) {
      if (e instanceof ApiError && e.message === 'PROJECT_NOT_FOUND') {
        setData(EMPTY_STATE);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadState(activeProject);
  }, [activeProject, loadState]);

  const taskItems = useMemo(() => {
    return data.items.flatMap((item) =>
      (item.tasks || []).map((task) => ({
        ...task,
        taskKey: `${item.id}::${task.taskId}`,
        requirementId: item.id,
        requirementTitle: item.title,
        requirementType: item.type,
        requirementWeek: item.week,
        requirementPriority: item.priority,
        requirementOwner: item.owner,
        requirementStatus: item.status,
        requirementWorkflowStatus: item.workflowStatus,
        requirementUpdatedAt: item.updatedAt,
        requirementSummary: item.summary,
        requirement: item
      }))
    );
  }, [data.items]);

  return {
    project: activeProject,
    projects,
    data,
    taskItems,
    loading,
    error,
    refresh,
    loadState,
    loadProjects
  };
}
