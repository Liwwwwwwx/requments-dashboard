import { Select, Typography } from 'antd';
import { FolderOutlined } from '@ant-design/icons';

const { Text } = Typography;

const NAV_GROUPS = [
  {
    key: 'inbox',
    label: '收件箱',
    items: [
      { key: 'all', label: '全部需求', filterStatus: 'all', color: 'var(--text-tertiary)' },
      { key: 'doing', label: '进行中', filterStatus: 'doing', color: 'var(--status-doing-dot)' },
      { key: 'todo', label: '待开始', filterStatus: 'todo', color: 'var(--status-todo-dot)' },
      { key: 'paused', label: '暂停', filterStatus: 'paused', color: 'var(--status-paused-dot)' },
      { key: 'done', label: '完成', filterStatus: 'done', color: 'var(--status-done-dot)' }
    ]
  }
];

export function Sidebar({
  project,
  projects,
  onProjectChange,
  data,
  navFilter,
  onNavFilterChange,
  selectedItem,
  onClearSelection
}) {
  const items = data.items || [];
  const counts = {
    all: items.length,
    doing: items.filter((i) => i.status === 'doing').length,
    todo: items.filter((i) => i.status === 'todo').length,
    paused: items.filter((i) => i.status === 'paused').length,
    done: items.filter((i) => i.status === 'done').length
  };

  const currentProject = projects.find((p) => p.id === project);

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span>项目</span>
          </div>
          <div style={{ padding: '0 10px' }}>
            <Select
              value={project}
              onChange={onProjectChange}
              style={{ width: '100%' }}
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
              placeholder="选择项目"
              size="middle"
              suffixIcon={<FolderOutlined />}
            />
          </div>
        </section>

        {NAV_GROUPS.map((group) => (
          <section key={group.key} className="sidebar-section">
            <div className="sidebar-eyebrow">
              <span>{group.label}</span>
            </div>
            <nav className="sidebar-nav">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-nav-item ${navFilter === item.filterStatus ? 'active' : ''}`}
                  onClick={() => {
                    onNavFilterChange(item.filterStatus);
                    onClearSelection();
                  }}
                >
                  <span className="icon" style={{ background: item.color }} />
                  <span className="label">{item.label}</span>
                  <span className="count">{counts[item.key] ?? 0}</span>
                </button>
              ))}
            </nav>
          </section>
        ))}

        <section className="sidebar-section">
          <div className="sidebar-eyebrow">
            <span>角色</span>
          </div>
          <nav className="sidebar-nav">
            <button type="button" className="sidebar-nav-item" disabled style={{ opacity: 0.4 }}>
              <span className="icon" style={{ background: 'var(--role-contract)' }} />
              <span className="label">契约</span>
              <span className="count">—</span>
            </button>
            <button type="button" className="sidebar-nav-item" disabled style={{ opacity: 0.4 }}>
              <span className="icon" style={{ background: 'var(--role-frontend)' }} />
              <span className="label">前端</span>
              <span className="count">—</span>
            </button>
            <button type="button" className="sidebar-nav-item" disabled style={{ opacity: 0.4 }}>
              <span className="icon" style={{ background: 'var(--role-backend)' }} />
              <span className="label">后端</span>
              <span className="count">—</span>
            </button>
            <button type="button" className="sidebar-nav-item" disabled style={{ opacity: 0.4 }}>
              <span className="icon" style={{ background: 'var(--role-qa)' }} />
              <span className="label">测试</span>
              <span className="count">—</span>
            </button>
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
