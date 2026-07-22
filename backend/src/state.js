"use strict";

const { assertRequirementTransition, assertTaskTransition } = require("./state-machine");

const BOARD_STATUSES = [
  { key: "todo", label: "待开始", tone: "neutral" },
  { key: "doing", label: "进行中", tone: "active" },
  { key: "blocked", label: "阻塞", tone: "blocked" },
  { key: "done", label: "完成", tone: "success" }
];

const DEFAULT_TYPE = "工程";
const DEFAULT_OWNER = "未分配";
const DEFAULT_PRIORITY = "P1";

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function priorityRank(priority) {
  if (priority === "P0") return 0;
  if (priority === "P1") return 1;
  return 2;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function renderDetail(detail) {
  return {
    goal: detail?.goal || "",
    next: detail?.next || ""
  };
}

function getOrCreateRequirement(state, id) {
  if (!state.requirements.has(id)) {
    state.requirements.set(id, {
      id,
      feature: "",
      title: "",
      type: DEFAULT_TYPE,
      status: "todo",
      workflowStatus: "draft",
      week: "",
      dueDate: "",
      owner: DEFAULT_OWNER,
      priority: DEFAULT_PRIORITY,
      createdBy: "",
      createdAt: "",
      updatedAt: localDate(),
      summary: "",
      detail: { goal: "", scope: [], nonGoals: [], next: "" },
      acceptance: [],
      links: [],
      sources: [],
      notes: [],
      tasks: [],
      contract: { ready: false, endpoints: [] }
    });
  }
  return state.requirements.get(id);
}

function upsertTask(requirement, nextTask) {
  const index = requirement.tasks.findIndex((t) => t.taskId === nextTask.taskId);
  if (index >= 0) {
    requirement.tasks[index] = { ...requirement.tasks[index], ...nextTask };
    return requirement.tasks[index];
  }
  requirement.tasks.push(nextTask);
  return nextTask;
}

function applyEvent(state, event) {
  if (!event || typeof event !== "object") return;

  const kind = event.kind || event.type;
  if (!kind) return;

  if (kind === "req.new") {
    const req = getOrCreateRequirement(state, event.requirementId);
    req.id = event.requirementId;
    req.feature = event.feature || "";
    req.title = event.title || "";
    req.type = event.requirementType || event.type || DEFAULT_TYPE;
    req.status = event.status || "todo";
    req.workflowStatus = event.workflowStatus || "ready-for-task";
    req.week = event.week || "";
    req.dueDate = event.dueDate || localDate();
    req.owner = event.owner || DEFAULT_OWNER;
    req.priority = event.priority || DEFAULT_PRIORITY;
    req.createdBy = event.createdBy || event.created_by || event.actor || "";
    req.createdAt = event.createdAt || event.updatedAt || event.at || (event.ts ? new Date(event.ts).toISOString() : localDate());
    req.updatedAt = event.updatedAt || localDate();
    req.summary = event.summary || "";
    req.detail = {
      goal: event.detail?.goal || req.summary,
      scope: normalizeArray(event.detail?.scope),
      nonGoals: normalizeArray(event.detail?.nonGoals),
      next: event.detail?.next || ""
    };
    req.acceptance = normalizeArray(event.acceptance);
    req.links = normalizeArray(event.links);
    req.sources = normalizeArray(event.sources);
    req.needsContract = Boolean(event.needsContract);
    return;
  }

  if (!event.requirementId) return;
  const req = getOrCreateRequirement(state, event.requirementId);

  if (kind === "req.status") {
    if (event.status) {
      assertRequirementTransition(req.status, event.status, event.requirementId);
      req.status = event.status;
    }
    if (event.workflowStatus) req.workflowStatus = event.workflowStatus;
    if (event.next !== undefined) req.detail.next = event.next;
    req.updatedAt = event.updatedAt || localDate();
    return;
  }

  if (kind === "req.patch") {
    if (event.title !== undefined) req.title = event.title;
    if (event.summary !== undefined) req.summary = event.summary;
    if (event.priority !== undefined) req.priority = event.priority;
    if (event.owner !== undefined) req.owner = event.owner;
    if (event.week !== undefined) req.week = event.week;
    if (event.dueDate !== undefined) req.dueDate = event.dueDate;
    if (event.status !== undefined) req.status = event.status;
    if (event.workflowStatus !== undefined) req.workflowStatus = event.workflowStatus;
    if (event.detail && typeof event.detail === "object") {
      req.detail = {
        ...req.detail,
        ...event.detail,
        scope: event.detail.scope !== undefined ? normalizeArray(event.detail.scope) : req.detail.scope,
        nonGoals: event.detail.nonGoals !== undefined ? normalizeArray(event.detail.nonGoals) : req.detail.nonGoals
      };
    }
    if (event.acceptance !== undefined) req.acceptance = normalizeArray(event.acceptance);
    if (event.links !== undefined) req.links = normalizeArray(event.links);
    if (event.sources !== undefined) req.sources = normalizeArray(event.sources);
    req.updatedAt = event.updatedAt || localDate();
    return;
  }

  if (kind === "task.new") {
    upsertTask(req, {
      taskId: event.taskId,
      role: event.role || "general",
      title: event.title || event.taskId,
      scope: event.scope || "",
      status: event.status || "todo",
      owner: event.owner || null,
      agent: null,
      verify: null,
      notes: null,
      files: []
    });
    req.updatedAt = event.updatedAt || localDate();
    return;
  }

  if (kind === "task.status") {
    let task = req.tasks.find((t) => t.taskId === event.taskId);
    if (!task) {
      task = upsertTask(req, {
        taskId: event.taskId,
        role: event.role || "general",
        title: event.title || event.taskId,
        scope: event.scope || "",
        status: event.status || "todo",
        owner: event.owner || null,
        agent: null,
        verify: null,
        notes: null,
        files: []
      });
    }
    if (event.status) {
      assertTaskTransition(task.status, event.status, event.requirementId, event.taskId);
      task.status = event.status;
    }
    if (event.role !== undefined) task.role = event.role;
    if (event.title !== undefined) task.title = event.title;
    if (event.scope !== undefined) task.scope = event.scope;
    if (event.owner !== undefined) task.owner = event.owner;
    if (event.agent !== undefined) task.agent = event.agent;
    if (event.verify !== undefined) task.verify = event.verify;
    if (event.notes !== undefined) task.notes = event.notes;
    if (event.files !== undefined) task.files = normalizeArray(event.files);
    req.updatedAt = event.updatedAt || localDate();
    return;
  }

  if (kind === "contract.set") {
    req.contract = {
      ready: normalizeArray(event.endpoints).length > 0,
      endpoints: normalizeArray(event.endpoints)
    };
    req.updatedAt = event.updatedAt || localDate();
    return;
  }

  if (kind === "note.add") {
    req.notes.push({
      text: event.text || "",
      at: event.at || new Date().toISOString(),
      agent: event.agent || null
    });
    req.updatedAt = event.updatedAt || localDate();
  }
}

function buildState(events) {
  const state = {
    updatedAt: localDate(),
    statuses: BOARD_STATUSES,
    requirements: new Map()
  };

  for (const event of events) {
    applyEvent(state, event);
  }

  const items = Array.from(state.requirements.values())
    .map((item) => {
      return {
        id: item.id,
        title: item.title,
        status: item.status,
        owner: item.owner,
        priority: item.priority,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        summary: item.summary,
        detail: renderDetail(item.detail),
        acceptance: clone(normalizeArray(item.acceptance)),
        notes: clone(normalizeArray(item.notes))
      };
    })
    .sort((a, b) => {
      const byStatus = BOARD_STATUSES.findIndex((s) => s.key === a.status)
        - BOARD_STATUSES.findIndex((s) => s.key === b.status);
      if (byStatus !== 0) return byStatus;
      const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
      if (byPriority !== 0) return byPriority;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });

  return {
    updatedAt: state.updatedAt,
    statuses: BOARD_STATUSES,
    items
  };
}

module.exports = {
  BOARD_STATUSES,
  buildState,
  applyEvent
};
