'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchState, listProjects, renderState, ApiError } from '@/lib/api';
import type { BoardState, Project } from '@/lib/types';

interface UseRequirementsResult {
  project: string;
  projects: Project[];
  data: BoardState;
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

  return {
    project: activeProject,
    projects,
    data,
    loading,
    error,
    refresh,
    loadState,
    loadProjects
  };
}
