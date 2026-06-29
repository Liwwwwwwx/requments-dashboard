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
  if (priority === 'P0') return '#ef4444';
  if (priority === 'P1') return '#f59e0b';
  if (priority === 'P2') return '#14b8a6';
  return '#94a3b8';
}

const PRIORITY_TOKEN = {
  P0: { chip: 'chip-p0', bar: 'priority-p0' },
  P1: { chip: 'chip-p1', bar: 'priority-p1' },
  P2: { chip: 'chip-p2', bar: 'priority-p2' }
};

export function priorityChipClass(priority) {
  return PRIORITY_TOKEN[priority]?.chip || 'chip-p3';
}

export function priorityBarClass(priority) {
  return PRIORITY_TOKEN[priority]?.bar || 'priority-p3';
}

const STATUS_TOKEN = {
  todo: 'chip-status-todo',
  doing: 'chip-status-doing',
  paused: 'chip-status-paused',
  done: 'chip-status-done',
  blocked: 'chip-status-blocked',
  claimed: 'chip-status-claimed',
  accepted: 'chip-status-accepted',
  working: 'chip-status-doing'
};

export function statusChipClass(status) {
  return STATUS_TOKEN[status] || 'chip-status-todo';
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
