import { useEffect, useMemo, useState } from 'react';
import { Layout, Button, Spin, Alert } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';
import { useRequirements } from './hooks/useRequirements';
import { Sidebar } from './components/Sidebar';
import { RequirementGrid } from './components/RequirementGrid';
import { RequirementDetailView } from './components/RequirementDetailView';
import { AiUsageDashboard } from './components/AiUsageDashboard';

const { Content } = Layout;

const DEFAULT_FILTERS = {
  query: '',
  type: 'all',
  role: 'all',
  status: 'all',
  priority: 'all',
  week: 'all'
};

const DEFAULT_PROJECT = 'default';

function HomeRedirect() {
  return <Navigate to={`/p/${DEFAULT_PROJECT}`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/ai-usage" element={<AppLayout />} />
      <Route path="/p/:project" element={<AppLayout />} />
      <Route path="/p/:project/r/:reqId" element={<AppLayout />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { project, reqId } = useParams();
  const { projects, data, taskItems, loading, error, refresh } = useRequirements({ project });

  const [navFilter, setNavFilter] = useState('all');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const workspace = location.pathname.startsWith('/ai-usage') ? 'ai-usage' : 'requirements';
  const selectedReqId = reqId || null;

  // 项目列表到达后，如果当前 project 不在列表里，导航到列表里第一个
  useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (!project || !projects.find((p) => p.id === project)) {
      const next = projects[0].id;
      if (workspace === 'ai-usage') {
        navigate(`/ai-usage`, { replace: true });
      } else {
        navigate(`/p/${next}`, { replace: true });
      }
    }
  }, [projects, project, workspace, navigate]);

  const selectedItem = useMemo(() => {
    return data.items.find((i) => i.id === selectedReqId) || null;
  }, [data.items, selectedReqId]);

  // view 隐式: workspace=ai-usage → ai-usage，否则 selectedItem 决定 detail / list
  const view = workspace === 'ai-usage' ? 'ai-usage' : selectedItem ? 'detail' : 'list';

  const handleSelect = (reqId) => {
    navigate(`/p/${project}/r/${reqId}`);
  };

  const handleBack = () => {
    navigate(`/p/${project}`);
  };

  const handleProjectChange = (nextProject) => {
    setNavFilter('all');
    navigate(`/p/${nextProject}`);
  };

  const handleWorkspaceChange = (nextWorkspace) => {
    if (nextWorkspace === 'ai-usage') {
      navigate('/ai-usage');
    } else {
      navigate(`/p/${project || DEFAULT_PROJECT}`);
    }
  };

  // 工具栏统计
  const items = data.items || [];
  const total = items.length;
  const doing = items.filter((i) => i.status === 'doing').length;
  const todo = items.filter((i) => i.status === 'todo').length;
  const paused = items.filter((i) => i.status === 'paused').length;
  const done = items.filter((i) => i.status === 'done').length;
  const blocked = items.reduce((acc, item) => acc + (item.taskStats?.blocked || 0), 0);
  const currentProject = projects.find((p) => p.id === project);

  // 当前周
  const currentWeek = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }, []);

  return (
    <Layout className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-brand">
            <span className="dot" />
            需求<span className="accent">看板</span>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-project">
            <span className="toolbar-project-label">{workspace === 'ai-usage' ? '工作台' : '项目'}</span>
            <span className="toolbar-project-name">
              {workspace === 'ai-usage' ? 'AI 用量' : currentProject?.name || project}
            </span>
          </div>
          <div className="toolbar-divider" />
          <span className="toolbar-week">{currentWeek}</span>
          {view === 'detail' && selectedItem && (
            <>
              <div className="toolbar-divider" />
              <span className="toolbar-week" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                / {selectedItem.id}
              </span>
            </>
          )}
        </div>

        <div className="toolbar-right">
          {workspace === 'requirements' && (
            <div className="toolbar-stats">
              <div className="toolbar-stat">
                <span className="dot" style={{ background: 'var(--text-tertiary)' }} />
                <span>全部</span>
                <strong>{total}</strong>
              </div>
              <div className="toolbar-stat">
                <span className="dot" style={{ background: 'var(--status-doing-dot)' }} />
                <span>进行中</span>
                <strong>{doing}</strong>
              </div>
              <div className="toolbar-stat">
                <span className="dot" style={{ background: 'var(--status-todo-dot)' }} />
                <span>待开始</span>
                <strong>{todo}</strong>
              </div>
              <div className="toolbar-stat">
                <span className="dot" style={{ background: 'var(--status-paused-dot)' }} />
                <span>暂停</span>
                <strong>{paused}</strong>
              </div>
              <div className="toolbar-stat">
                <span className="dot" style={{ background: 'var(--status-done-dot)' }} />
                <span>完成</span>
                <strong>{done}</strong>
              </div>
              <div className={`toolbar-stat ${blocked > 0 ? 'is-blocked' : ''}`}>
                <span className="dot" style={{ background: 'var(--status-blocked-dot)' }} />
                <span>阻塞</span>
                <strong>{blocked}</strong>
              </div>
            </div>
          )}
          {workspace === 'requirements' && (
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={refresh}
              type="primary"
              size="middle"
            >
              刷新
            </Button>
          )}
        </div>
      </header>

      <div className="layout">
        <Sidebar
          project={project}
          projects={projects}
          onProjectChange={handleProjectChange}
          data={data}
          navFilter={navFilter}
          onNavFilterChange={setNavFilter}
          selectedItem={selectedItem}
          onClearSelection={handleBack}
          workspace={workspace}
          onWorkspaceChange={handleWorkspaceChange}
        />

        <Content className="main">
          {workspace === 'requirements' && error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ margin: 24 }}
            />
          )}
          <Spin spinning={workspace === 'requirements' && loading}>
            {view === 'ai-usage' ? (
              <AiUsageDashboard />
            ) : view === 'list' ? (
              <RequirementGrid
                data={data}
                taskItems={taskItems}
                filters={filters}
                setFilters={setFilters}
                navFilter={navFilter}
                selected={selectedItem?.id}
                onSelect={handleSelect}
              />
            ) : (
              <RequirementDetailView
                item={selectedItem}
                taskItems={taskItems}
                onBack={handleBack}
                onClearSelection={handleBack}
              />
            )}
          </Spin>
        </Content>
      </div>
    </Layout>
  );
}

export default App;