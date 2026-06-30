export type RequirementStatus = 'todo' | 'doing' | 'paused' | 'done';
export type TaskStatus = 'todo' | 'claimed' | 'working' | 'done' | 'accepted' | 'blocked';
export type Priority = 'P0' | 'P1' | 'P2';
export type Role =
  | 'contract'
  | 'frontend'
  | 'backend'
  | 'review'
  | 'qa'
  | 'integration'
  | 'infra'
  | 'general';

export type WorkflowStatus = string;

export interface Endpoint {
  method?: string;
  path: string;
  permission?: string;
  reasonRequired?: boolean;
}

export interface Task {
  taskId: string;
  role: Role;
  title: string;
  scope?: string;
  status: TaskStatus;
  owner?: string | null;
  agent?: string | null;
  verify?: string | null;
  notes?: string | null;
  files?: string[];
  updatedAt?: string;
}

export interface TaskStats {
  total: number;
  done: number;
  active: number;
  blocked: number;
}

export interface RequirementDetail {
  goal?: string;
  scope: string[];
  nonGoals: string[];
  next?: string;
}

export interface RequirementLink {
  href: string;
  label: string;
}

export interface Note {
  text: string;
  at: string;
  agent: string | null;
}

export interface Requirement {
  id: string;
  feature?: string;
  title: string;
  type: string;
  status: RequirementStatus;
  workflowStatus: WorkflowStatus;
  week: string;
  dueDate?: string;
  owner: string;
  priority: Priority;
  updatedAt: string;
  summary: string;
  detail: RequirementDetail;
  acceptance: string[];
  links: RequirementLink[];
  sources: string[];
  notes: Note[];
  tasks: Task[];
  taskStats: TaskStats;
  contract: { ready: boolean; endpoints: Endpoint[] };
  needsContract?: boolean;
}

export interface BoardState {
  updatedAt: string;
  statuses: { key: RequirementStatus; label: string; tone: string }[];
  items: Requirement[];
}

export interface Project {
  id: string;
  name: string;
}

export type EventKind =
  | 'req.new'
  | 'req.status'
  | 'req.patch'
  | 'task.new'
  | 'task.status'
  | 'contract.set'
  | 'note.add';

export interface EventInput {
  eventId?: string;
  ts?: number;
  kind: EventKind;
  actor?: string;
  requirementId?: string;
  taskId?: string;
  project?: string;
  [key: string]: unknown;
}

export interface Filters {
  query: string;
  type: 'all' | string;
  role: 'all' | string;
  status: 'all' | RequirementStatus;
  priority: 'all' | Priority;
  week: 'all' | string;
}