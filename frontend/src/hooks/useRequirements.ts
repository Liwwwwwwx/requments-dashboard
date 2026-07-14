'use client';

import { useCallback, useEffect, useState } from 'react';
import { listProjects, listRequirements, ApiError } from '@/lib/api';
import { statusLabel } from '@/lib/utils';
import type { BoardState, Project, Requirement, RequirementStatus } from '@/lib/types';

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
const V2_STATUSES: BoardState['statuses'] = (['todo', 'doing', 'blocked', 'done'] as RequirementStatus[]).map(
  (status) => ({
    key: status,
    label: statusLabel(status).label,
    tone: status
  })
);

function stateFromRequirements(requirements: Requirement[]): BoardState {
  return {
    updatedAt: requirements.reduce((latest, item) => {
      if (!item.updatedAt) return latest;
      return item.updatedAt > latest ? item.updatedAt : latest;
    }, ''),
    statuses: V2_STATUSES,
    items: requirements
  };
}

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
        const res = await listRequirements(targetProject);
        setData(stateFromRequirements(res.requirements || []));
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'PROJECT_NOT_FOUND' || e.message === 'PROJECT_NOT_FOUND')) {
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
    await loadState(activeProject);
  }, [activeProject, loadState]);

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
