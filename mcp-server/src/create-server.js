import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TraceboardApiError } from "./api-client.js";

const statuses = ["todo", "doing", "blocked", "done"];
const priorities = ["P0", "P1", "P2"];

function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  const message = error instanceof TraceboardApiError
    ? `${error.code ? `${error.code}: ` : ""}${error.message}`
    : "TraceBoard 工具调用失败。";
  return { isError: true, content: [{ type: "text", text: message }] };
}

function projectFor(input, config) {
  const project = input.project || config.defaultProject;
  if (!project) throw new Error("必须提供 project，或设置 TRACEBOARD_DEFAULT_PROJECT。");
  return project;
}

function requirementSummary(requirement) {
  return {
    id: requirement.id,
    title: requirement.title,
    summary: requirement.summary,
    status: requirement.status,
    priority: requirement.priority,
    owner: requirement.owner,
    dueDate: requirement.dueDate,
    updatedAt: requirement.updatedAt
  };
}

export function createTraceboardMcpServer({ config, client }) {
  const server = new McpServer({
    name: "traceboard",
    version: "0.1.0"
  }, {
    instructions: "TraceBoard 用于管理项目需求。先用 list_projects 或 list_requirements 获取上下文；修改状态使用 change_requirement_status，添加讨论使用 add_requirement_note。删除项目或需求前必须先展示目标并取得用户明确确认，再传 confirm: true。"
  });

  server.registerTool("list_projects", {
    title: "列出项目",
    description: "列出当前 API 身份可访问的 TraceBoard 项目。",
    annotations: { readOnlyHint: true }
  }, async () => {
    try { return textResult(await client.listProjects()); } catch (error) { return errorResult(error); }
  });

  server.registerTool("get_project", {
    title: "获取项目",
    description: "获取一个项目的基础信息。",
    inputSchema: { project: z.string().min(1).optional() },
    annotations: { readOnlyHint: true }
  }, async (input) => {
    try { return textResult(await client.getProject(projectFor(input, config))); } catch (error) { return errorResult(error); }
  });

  server.registerTool("create_project", {
    title: "创建项目",
    description: "创建一个新项目，当前 API 身份会成为项目 owner。",
    inputSchema: {
      id: z.string().regex(/^[a-zA-Z0-9_-]+$/, "项目 ID 仅支持字母、数字、下划线和连字符"),
      name: z.string().trim().min(1).optional(),
      description: z.string().optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, async (input) => {
    try { return textResult(await client.createProject(input)); } catch (error) { return errorResult(error); }
  });

  server.registerTool("update_project", {
    title: "更新项目",
    description: "更新项目名称或说明。",
    inputSchema: {
      project: z.string().min(1).optional(),
      name: z.string().trim().min(1).optional(),
      description: z.string().optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, async (input) => {
    try {
      const { project, ...body } = input;
      if (!Object.keys(body).length) throw new Error("至少提供 name 或 description 之一。");
      return textResult(await client.updateProject(projectFor(input, config), body));
    } catch (error) { return errorResult(error); }
  });

  server.registerTool("delete_project", {
    title: "删除项目",
    description: "永久删除项目及其所有需求、事件和 AI 会话。仅项目 owner 可执行，必须取得用户明确确认。",
    inputSchema: { project: z.string().min(1).optional(), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
  }, async (input) => {
    try { return textResult(await client.deleteProject(projectFor(input, config))); } catch (error) { return errorResult(error); }
  });

  server.registerTool("list_requirements", {
    title: "列出需求",
    description: "列出项目需求；可按状态、优先级和关键词过滤。返回内容会限制为最相关的摘要。",
    inputSchema: {
      project: z.string().min(1).optional(),
      status: z.enum(statuses).optional(),
      priority: z.enum(priorities).optional(),
      query: z.string().trim().min(1).optional(),
      limit: z.number().int().min(1).max(100).default(50)
    },
    annotations: { readOnlyHint: true }
  }, async (input) => {
    try {
      const result = await client.listRequirements(projectFor(input, config));
      const query = input.query?.toLocaleLowerCase();
      const requirements = (result.requirements || []).filter((item) => {
        if (input.status && item.status !== input.status) return false;
        if (input.priority && item.priority !== input.priority) return false;
        if (query && !`${item.id} ${item.title} ${item.summary || ""}`.toLocaleLowerCase().includes(query)) return false;
        return true;
      }).slice(0, input.limit).map(requirementSummary);
      return textResult({ ok: true, project: result.project, total: requirements.length, requirements });
    } catch (error) { return errorResult(error); }
  });

  server.registerTool("get_requirement", {
    title: "获取需求",
    description: "获取单个需求的完整详情。",
    inputSchema: { project: z.string().min(1).optional(), requirementId: z.string().min(1) },
    annotations: { readOnlyHint: true }
  }, async (input) => {
    try { return textResult(await client.getRequirement(projectFor(input, config), input.requirementId)); } catch (error) { return errorResult(error); }
  });

  server.registerTool("get_requirement_history", {
    title: "获取需求历史",
    description: "获取需求的状态、字段和备注变更历史。",
    inputSchema: { project: z.string().min(1).optional(), requirementId: z.string().min(1), limit: z.number().int().min(1).max(100).default(50) },
    annotations: { readOnlyHint: true }
  }, async (input) => {
    try {
      const result = await client.getRequirementHistory(projectFor(input, config), input.requirementId);
      return textResult({ ...result, events: (result.events || []).slice(-input.limit) });
    } catch (error) { return errorResult(error); }
  });

  server.registerTool("create_requirement", {
    title: "创建需求",
    description: "在指定项目中创建一条需求。",
    inputSchema: {
      project: z.string().min(1).optional(),
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      goal: z.string().trim().min(1).optional(),
      priority: z.enum(priorities).default("P1"),
      status: z.enum(statuses).default("todo"),
      owner: z.string().trim().min(1).optional(),
      next: z.string().trim().min(1).optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, async (input) => {
    try {
      const { project, ...body } = input;
      return textResult(await client.createRequirement(projectFor(input, config), body));
    } catch (error) { return errorResult(error); }
  });

  server.registerTool("update_requirement", {
    title: "更新需求",
    description: "更新已有需求的字段；状态变更请使用 change_requirement_status。",
    inputSchema: {
      project: z.string().min(1).optional(),
      requirementId: z.string().min(1),
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).optional(),
      goal: z.string().optional(),
      priority: z.enum(priorities).optional(),
      owner: z.string().trim().min(1).optional(),
      week: z.string().trim().min(1).optional(),
      dueDate: z.string().trim().min(1).optional(),
      acceptance: z.array(z.string().trim().min(1)).min(1).optional(),
      next: z.string().trim().min(1).optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, async (input) => {
    try {
      const { project, requirementId, ...body } = input;
      return textResult(await client.updateRequirement(projectFor(input, config), requirementId, body));
    } catch (error) { return errorResult(error); }
  });

  server.registerTool("change_requirement_status", {
    title: "变更需求状态",
    description: "按 TraceBoard 状态机变更需求状态。",
    inputSchema: { project: z.string().min(1).optional(), requirementId: z.string().min(1), status: z.enum(statuses) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, async (input) => {
    try {
      return textResult(await client.updateRequirement(projectFor(input, config), input.requirementId, { status: input.status }));
    } catch (error) { return errorResult(error); }
  });

  server.registerTool("delete_requirement", {
    title: "删除需求",
    description: "从当前看板删除需求。删除事件会被保留用于审计，必须取得用户明确确认。",
    inputSchema: { project: z.string().min(1).optional(), requirementId: z.string().min(1), confirm: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
  }, async (input) => {
    try { return textResult(await client.deleteRequirement(projectFor(input, config), input.requirementId)); } catch (error) { return errorResult(error); }
  });

  server.registerTool("add_requirement_note", {
    title: "添加需求备注",
    description: "向需求历史添加一条备注。",
    inputSchema: { project: z.string().min(1).optional(), requirementId: z.string().min(1), text: z.string().trim().min(1) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, async (input) => {
    try {
      return textResult(await client.addRequirementNote(projectFor(input, config), input.requirementId, input.text));
    } catch (error) { return errorResult(error); }
  });

  return server;
}
