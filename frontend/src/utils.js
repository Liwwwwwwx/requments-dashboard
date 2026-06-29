export const REQUIREMENT_STATUS_LABELS = {
  todo: { label: '待开始', color: 'default' },
  doing: { label: '进行中', color: 'processing' },
  paused: { label: '暂停', color: 'warning' },
  done: { label: '完成', color: 'success' }
};

export const TASK_STATUS_LABELS = {
  todo: { label: '待开始', color: 'default' },
  claimed: { label: '已领取', color: 'warning' },
  working: { label: '进行中', color: 'processing' },
  done: { label: '已完成', color: 'success' },
  accepted: { label: '已验收', color: 'success' },
  blocked: { label: '阻塞', color: 'error' }
};

export const ROLE_META = {
  contract: { label: '契约', color: '#818cf8' },
  frontend: { label: '前端', color: '#c084fc' },
  backend: { label: '后端', color: '#22d3ee' },
  review: { label: '审查', color: '#fb923c' },
  qa: { label: '测试', color: '#34d399' },
  integration: { label: '联调', color: '#f472b6' },
  infra: { label: '基建', color: '#a78bfa' },
  general: { label: '通用', color: '#9ca3af' }
};

export function statusLabel(status) {
  return REQUIREMENT_STATUS_LABELS[status] || TASK_STATUS_LABELS[status] || { label: status, color: 'default' };
}

export function roleLabel(role) {
  return ROLE_META[role]?.label || role || '通用';
}

export function roleColor(role) {
  return ROLE_META[role]?.color || '#9ca3af';
}

export function priorityColor(priority) {
  if (priority === 'P0') return '#ff6f7d';
  if (priority === 'P1') return '#f4a24c';
  if (priority === 'P2') return '#52d6b8';
  return '#9ca3af';
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
