import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchState, renderState, listProjects } from '../api';

export function useRequirements({ project, fallbackProject = 'default' } = {}) {
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState({ statuses: [], items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeProject = project || fallbackProject;

  const loadProjects = useCallback(async () => {
    try {
      const res = await listProjects();
      setProjects(res.projects || []);
    } catch (_e) {
      // ignore project list errors
    }
  }, []);

  const loadState = useCallback(async (targetProject = activeProject) => {
    if (!targetProject) return;
    setLoading(true);
    setError(null);
    try {
      const state = await fetchState(targetProject);
      setData(state);
    } catch (e) {
      if (e.message === 'PROJECT_NOT_FOUND') {
        setData({ statuses: [], items: [] });
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  const refresh = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    setError(null);
    try {
      await renderState(activeProject);
      const state = await fetchState(activeProject);
      setData(state);
    } catch (e) {
      if (e.message === 'PROJECT_NOT_FOUND') {
        setData({ statuses: [], items: [] });
      } else {
        setError(e.message);
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
    loadState
  };
}