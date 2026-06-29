import { useMemo, useState, useEffect } from 'react';
import { Progress, Typography, Empty, Select } from 'antd';
import { statusLabel, priorityChipClass, statusChipClass, roleLabel } from '../utils';
import { TaskDrawer } from './TaskDrawer';

const { Paragraph, Text } = Typography;

const ROLE_ORDER = ['contract', 'frontend', 'backend', 'review', 'qa', 'integration', 'infra', 'general'];

const ROLE_LABELS_CN = {
  contract: '契约',
  frontend: '前端',
  backend: '后端',
  review: '审查',
  qa: '测试',
  integration: '联调',
  infra: '基建',
  general: '通用'
};

export function RequirementDetailView({ item, taskItems, onBack, onClearSelection }) {
  const [drawerTask, setDrawerTask] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    setDrawerTask(null);
    setRoleFilter('all');
  }, [item?.id]);

  const tasks = item?.tasks || [];
  const taskStats = item?.taskStats || { total: 0, done: 0, active: 0, blocked: 0 };
  const progress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;
  const blockedTasks = tasks.filter((task) => task.status === 'blocked');

  const availableRoles = useMemo(() => {
    const set = new Set(tasks.map((t) => t.role || 'general'));
    return Array.from(set);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (roleFilter === 'all') return tasks;
    return tasks.filter((task) => (task.role || 'general') === roleFilter);
  }, [tasks, roleFilter]);

  const openTask = (task) => {
    const full = taskItems.find((t) => t.taskKey === `${item.id}::${task.taskId}`);
    setDrawerTask(full || task);
  };

  if (!item) {
    return (
      <div className="empty-state">
        <div>
          <div className="glyph">∅</div>
          <div>请选择一条需求</div>
        </div>
      </div>
    );
  }

  const status = statusLabel(item.status);

  return (
    <div className="view-detail">
      <button type="button" className="view-detail-back" onClick={onBack || onClearSelection}>
        <span className="arrow">←</span>
        <span>返回需求列表</span>
      </button>

      <header className="view-detail-header">
        <div className="view-detail-eyebrow">
          <span className="id">{item.id}</span>
          <span>·</span>
          <span>需求详情</span>
        </div>
        <h1 className="view-detail-title">{item.title}</h1>
        <div className="view-detail-chips">
          {item.priority && (
            <span className={`chip ${priorityChipClass(item.priority)}`}>
              <span className="chip-dot" />
              {item.priority}
            </span>
          )}
          <span className={`chip ${statusChipClass(item.status)}`}>
            <span className="chip-dot" />
            {status.label}
          </span>
          {item.type && <span className="chip">{item.type}</span>}
          {item.week && <span className="chip chip-mono">{item.week}</span>}
        </div>
        <div className="view-detail-meta">
          <span className="kv">
            <span className="k">负责人</span>
            <span className="v">{item.owner || '未分配'}</span>
          </span>
          <span className="dot">·</span>
          <span className="kv">
            <span className="k">更新时间</span>
            <span className="v">{item.updatedAt || '-'}</span>
          </span>
          {item.dueDate && (
            <>
              <span className="dot">·</span>
              <span className="kv">
                <span className="k">截止</span>
                <span className="v">{item.dueDate}</span>
              </span>
            </>
          )}
          {item.workflowStatus && (
            <>
              <span className="dot">·</span>
              <span className="kv">
                <span className="k">工作流</span>
                <span className="v">{item.workflowStatus}</span>
              </span>
            </>
          )}
        </div>
      </header>

      <div className="view-detail-grid">
        <div>
          {/* Summary */}
          {(item.summary || item.detail?.goal) && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">摘要</h3>
              <div className="view-detail-section-body">
                <Paragraph style={{ marginBottom: 0 }}>
                  {item.summary || item.detail?.goal}
                </Paragraph>
              </div>
            </section>
          )}

          {/* Next Steps */}
          {item.detail?.next && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">下一步</h3>
              <div className="view-detail-section-body">
                <Paragraph style={{ marginBottom: 0 }}>{item.detail.next}</Paragraph>
              </div>
            </section>
          )}

          {/* Scope / Non-Goals / Acceptance */}
          {(item.detail?.scope?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                范围 <span className="count">· {item.detail.scope.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.detail.scope.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </section>
          )}

          {(item.detail?.nonGoals?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                不做范围 <span className="count">· {item.detail.nonGoals.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.detail.nonGoals.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </section>
          )}

          {(item.acceptance?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                验收点 <span className="count">· {item.acceptance.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.acceptance.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </section>
          )}

          {/* Blocked tasks (high visibility) */}
          {blockedTasks.length > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">
                阻塞任务 <span className="count">· {blockedTasks.length}</span>
              </h3>
              <div className="view-detail-section-body">
                <ul>
                  {blockedTasks.map((task) => (
                    <li key={task.taskId}>
                      <Text strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {task.taskId}
                      </Text>
                      <span style={{ marginLeft: 8 }}>{task.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <section className="view-detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <h3 className="view-detail-section-title" style={{ marginBottom: 0 }}>
                  任务 <span className="count">· {filteredTasks.length}/{tasks.length}</span>
                </h3>
                {availableRoles.length > 1 && (
                  <Select
                    value={roleFilter}
                    onChange={setRoleFilter}
                    style={{ width: 140 }}
                    size="small"
                    options={[
                      { value: 'all', label: '所有角色' },
                      ...availableRoles.map((r) => ({ value: r, label: ROLE_LABELS_CN[r] || roleLabel(r) }))
                    ]}
                  />
                )}
              </div>
              {filteredTasks.length === 0 ? (
                <Empty description="当前筛选下无任务" />
              ) : (
                <div className="task-grid">
                  {filteredTasks.map((task) => {
                    const taskStatus = statusLabel(task.status);
                    const hasAgent = Boolean(task.agent);
                    const hasVerify = Boolean(task.verify);
                    const hasDate = Boolean(task.updatedAt);

                    return (
                      <div
                        key={task.taskId}
                        role="button"
                        tabIndex={0}
                        className={`task-card role-${task.role || 'general'}`}
                        onClick={() => openTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openTask(task);
                          }
                        }}
                      >
                        <div className="task-card-head">
                          <span className="task-card-id">{task.taskId}</span>
                          <span className={`chip ${statusChipClass(task.status)}`}>
                            <span className="chip-dot" />
                            {taskStatus.label}
                          </span>
                        </div>
                        <div className="task-card-title">{task.title || task.taskId}</div>
                        {task.scope && (
                          <div className="task-card-scope">{task.scope}</div>
                        )}
                        <div className="task-card-foot">
                          <span className={hasAgent ? 'agent' : 'agent agent-empty'}>
                            {hasAgent ? `@${task.agent}` : '@未领取'}
                          </span>
                          {hasVerify && <span className="verify">✓ 已验证</span>}
                          {hasDate && <span className="spacer" />}
                          {hasDate && <span className="date">{task.updatedAt}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Links */}
          {(item.links?.length || 0) > 0 && (
            <section className="view-detail-section">
              <h3 className="view-detail-section-title">关联文档</h3>
              <div className="view-detail-section-body">
                <ul>
                  {item.links.map((link, i) => (
                    <li key={i}>
                      <a href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        <aside className="view-detail-aside">
          <div className="stat-block">
            <div className="stat-block-label">进度</div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
              <Progress
                type="circle"
                percent={progress}
                size={120}
                strokeWidth={4}
                strokeColor={taskStats.blocked > 0 ? 'var(--status-blocked-dot)' : 'var(--accent)'}
                trailColor="var(--bg-surface-3)"
              />
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                {taskStats.done || 0}
              </strong> / {taskStats.total || 0} 任务已完成
            </div>
          </div>

          <div className="stat-block">
            <div className="stat-block-label">任务统计</div>
            <div className="stat-row">
              <span>总数</span>
              <span className="v">{taskStats.total || 0}</span>
            </div>
            <div className="stat-row">
              <span>已完成</span>
              <span className="v" style={{ color: 'var(--status-done-text)' }}>
                {taskStats.done || 0}
              </span>
            </div>
            <div className="stat-row">
              <span>进行中</span>
              <span className="v" style={{ color: 'var(--status-doing-text)' }}>
                {taskStats.active || 0}
              </span>
            </div>
            <div className={`stat-row ${taskStats.blocked > 0 ? 'is-blocked' : ''}`}>
              <span>阻塞</span>
              <span className="v">{taskStats.blocked || 0}</span>
            </div>
          </div>

          {(item.contract?.endpoints?.length || 0) > 0 && (
            <div className="stat-block">
              <div className="stat-block-label">接口契约</div>
              {item.contract.endpoints.map((ep, i) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                    {(ep.method || 'METHOD').toUpperCase()}
                  </span>
                  <span style={{ color: 'var(--text-primary)', marginLeft: 6 }}>{ep.path}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <TaskDrawer task={drawerTask} onClose={() => setDrawerTask(null)} />
    </div>
  );
}
