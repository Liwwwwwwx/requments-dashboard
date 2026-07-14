export type RequirementStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type Priority = 'P0' | 'P1' | 'P2';

export interface RequirementDetail {
  goal?: string;
  next?: string;
}

export interface Note {
  text: string;
  at: string;
  agent: string | null;
}

export interface Requirement {
  id: string;
  title: string;
  status: RequirementStatus;
  owner: string;
  priority: Priority;
  createdBy?: string;
  createdAt?: string;
  updatedAt: string;
  summary: string;
  detail: RequirementDetail;
  acceptance: string[];
  notes: Note[];
}

export interface BoardState {
  updatedAt: string;
  statuses: { key: RequirementStatus; label: string; tone: string }[];
  items: Requirement[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type EventKind =
  | 'req.new'
  | 'req.status'
  | 'req.patch'
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
  status: 'all' | RequirementStatus;
  priority: 'all' | Priority;
  owner: 'all' | string;
}

export interface RequirementEvent {
  eventId?: string;
  ts?: number;
  kind?: EventKind | string;
  actor?: string;
  requirementId?: string;
  taskId?: string;
  status?: string;
  title?: string;
  summary?: string;
  text?: string;
  at?: string;
  updatedAt?: string;
  event?: Record<string, unknown>;
}
