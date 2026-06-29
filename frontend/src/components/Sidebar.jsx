import { BarChartOutlined, UnorderedListOutlined, FolderOutlined } from '@ant-design/icons';

export function Sidebar({
  project,
  projects,
  onProjectChange,
  selectedItem,
  onClearSelection,
  workspace,
  onWorkspaceChange
}) {
  const currentProject = projects.find((p) => p.id === project);

  const handleProjectClick = (projectId) => {
    onProjectChange(projectId);
    if (workspace !== 'requirements') {
      onWorkspaceChange('requirements');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span>工作区</span>
          </div>
          <nav className="sidebar-nav">
            <button
              type="button"
              className={`sidebar-nav-item ${workspace === 'requirements' ? 'active' : ''}`}
              onClick={() => onWorkspaceChange('requirements')}
            >
              <span className="icon nav-icon" style={{ background: 'var(--accent)' }}>
                <UnorderedListOutlined />
              </span>
              <span className="label">需求看板</span>
            </button>
            <button
              type="button"
              className={`sidebar-nav-item ${workspace === 'ai-usage' ? 'active' : ''}`}
              onClick={() => onWorkspaceChange('ai-usage')}
            >
              <span className="icon nav-icon" style={{ background: 'var(--role-qa)' }}>
                <BarChartOutlined />
              </span>
              <span className="label">AI 用量</span>
              <span className="count">新</span>
            </button>
          </nav>
        </section>

        <section className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span>项目</span>
          </div>
          <nav className="sidebar-nav">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sidebar-nav-item ${project === p.id ? 'active' : ''}`}
                onClick={() => handleProjectClick(p.id)}
              >
                <FolderOutlined className="sidebar-project-icon" />
                <span className="label">{p.name}</span>
              </button>
            ))}
          </nav>
        </section>
      </div>

      {selectedItem && (
        <div className="sidebar-current">
          <div className="sidebar-current-eyebrow">正在查看</div>
          <div className="sidebar-current-title">{selectedItem.title}</div>
          <div className="sidebar-current-meta">
            <span>{selectedItem.id}</span>
            <span>·</span>
            <span>{selectedItem.owner || '未分配'}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
