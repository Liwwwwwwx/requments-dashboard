export interface AiAccount {
  id: string;
  accountName: string;
  baseUrl: string;
  modelId: string;
  hasApiKey: boolean;
}

export interface AiConversation {
  id: string;
  userId: string;
  projectId: string;
  requirementId: string | null;
  title: string | null;
  model: string;
  accountId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown;
  tokensIn: number;
  tokensOut: number;
  ts: number;
}

export interface AiChatResult {
  ok: true;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;
}

export interface AiProposalEvent {
  kind: string;
  requirementId?: string;
  taskId?: string;
  status?: string;
  title?: string;
  summary?: string;
  priority?: string;
  owner?: string;
  text?: string;
  agent?: string;
  verify?: string;
  notes?: string;
  role?: string;
  week?: string;
  dueDate?: string;
  detail?: Record<string, unknown>;
  acceptance?: string[];
  endpoints?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AiProposal {
  id: string;
  conversationId: string;
  messageId: string;
  events: AiProposalEvent[];
  status: 'pending' | 'applied' | 'discarded';
  appliedAt?: number | null;
  appliedBy?: string | null;
  createdAt: number;
}