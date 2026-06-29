import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchState, renderState, listProjects } from '../api';

export function useRequirements() {
  const [project, setProject] = useState('default');
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState({ statuses: [], items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await listProjects();
      setProjects(res.projects || []);
      if (res.projects && res.projects.length > 0 && !res.projects.find((p) => p.id === project)) {
        setProject(res.projects[0].id);
      }
    } catch (e) {
      // ignore project list errors
    }
  }, [project]);

  const loadState = useCallback(async (targetProject = project) => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchState(targetProject);
      setData(state);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [project]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await renderState(project);
      const state = await fetchState(project);
      setData(state);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadState(project);
  }, [project, loadState]);

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
    project,
    setProject,
    projects,
    data,
    taskItems,
    loading,
    error,
    refresh,
    loadState
  };
}
