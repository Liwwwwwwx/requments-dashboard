"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const {
  projectPaths,
  listProjectDetails,
  ensureProject,
  ensureProjectMetadata,
  getProject,
  updateProject,
  isValidProjectId
} = require("./projects");
const { readEvents, appendEvents, withLock } = require("./events");
const { render } = require("./state");
const { assertRequirementTransition } = require("./state-machine");
const { RequirementId } = require("./schema");
const { httpError } = require("./errors");
const { createAuthRoutes } = require("./auth/routes");
const { authMiddleware } = require("./auth/middleware");
const { initUsers } = require("./auth/users");
const { createAiRoutes } = require("./ai/routes");

const V2_REQUIREMENT_STATUSES = new Set(["todo", "doing", "blocked", "done"]);
const V2_PRIORITIES = new Set(["P0", "P1", "P2"]);
const V2_REQUIREMENT_HISTORY_KINDS = new Set(["req.new", "req.status", "req.patch", "note.add"]);
const V2_REQUIREMENT_EVENT_KINDS = new Set(["req.status", "req.patch", "note.add"]);
const V2_PROJECT_EVENT_KINDS = new Set(["req.new", "req.status", "req.patch", "note.add"]);
const V2_DETAIL_STRING_FIELDS = ["goal", "next"];
const V2_DETAIL_STRING_LIST_FIELDS = ["scope", "nonGoals"];

function createRoutes(rootDir) {
  const router = express.Router();

  const dbPath = path.join(rootDir, "data", "users.db");
  const users = initUsers(dbPath);

  router.use(createAuthRoutes(rootDir));

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "requirements-board-backend", dataDir: path.join(rootDir, "data") });
  });

  router.use(authMiddleware(users));
  router.use("/ai", createAiRoutes(rootDir));

  router.param("project", (req, _res, next, value) => {
    if (!isValidProjectId(value)) {
      return next(httpError(400, "INVALID_PROJECT_ID", `项目 id 非法：${value}`));
    }
    return next();
  });

  router.param("requirementId", (req, _res, next, value) => {
    if (!RequirementId.safeParse(value).success) {
      return next(httpError(400, "INVALID_REQUIREMENT_ID", `需求 id 非法：${value}`));
    }
    return next();
  });

  router.get("/projects", (_req, res) => {
    const projects = listProjectDetails(rootDir);
    res.json({ ok: true, projects });
  });

  router.post("/projects", express.json(), (req, res, next) => {
    const id = String(req.body.id || "").trim();
    if (!id || !isValidProjectId(id)) {
      return next(httpError(400, "INVALID_PROJECT_ID", `项目 id 非法：${id}`));
    }
    const paths = projectPaths(rootDir, id);
    if (fs.existsSync(paths.dataDir)) {
      return next(httpError(409, "PROJECT_ALREADY_EXISTS", `项目已存在：${paths.projectId}`));
    }
    ensureProject(rootDir, id);
    const project = ensureProjectMetadata(rootDir, paths.projectId, {
      name: req.body.name,
      description: req.body.description
    });
    return res.json({ ok: true, project: { ...project, dataDir: paths.dataDir } });
  });

  router.get("/projects/:project", (req, res, next) => {
    const project = getProject(rootDir, req.params.project);
    if (!project) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    return res.json({ ok: true, project });
  });

  router.patch("/projects/:project", express.json(), (req, res, next) => {
    if (req.body.name !== undefined && !String(req.body.name || "").trim()) {
      return next(httpError(400, "MISSING_PROJECT_NAME", "项目名称不能为空"));
    }
    const project = updateProject(rootDir, req.params.project, {
      name: req.body.name,
      description: req.body.description
    });
    if (!project) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    return res.json({ ok: true, project });
  });

  function nextRequirementId(items) {
    const max = items.reduce((acc, item) => {
      const match = String(item.id || "").match(/^REQ-(\d+)$/);
      return match ? Math.max(acc, Number(match[1])) : acc;
    }, 0);
    return `REQ-${String(max + 1).padStart(4, "0")}`;
  }

  function assertV2Status(value, next) {
    if (value === undefined) return null;
    const status = String(value);
    if (!V2_REQUIREMENT_STATUSES.has(status)) {
      next(httpError(400, "INVALID_STATUS", "需求状态仅支持 todo、doing、blocked、done"));
      return null;
    }
    return status;
  }

  function assertV2Priority(value, next) {
    if (value === undefined) return "P1";
    const priority = String(value);
    if (!V2_PRIORITIES.has(priority)) {
      next(httpError(400, "INVALID_PRIORITY", "需求优先级仅支持 P0、P1、P2"));
      return null;
    }
    return priority;
  }

  function assertV2StatusTransition(prevStatus, nextStatus, requirementId, next) {
    try {
      assertRequirementTransition(prevStatus, nextStatus, requirementId);
      return true;
    } catch (err) {
      next(httpError(400, "INVALID_STATUS_TRANSITION", err.message));
      return false;
    }
  }

  function validateV2StatusTransitions(currentStatus, events, requirementId, next) {
    let status = currentStatus;
    for (const event of events) {
      const nextStatus = event.kind === "req.status" || event.kind === "req.patch"
        ? event.status
        : undefined;
      if (nextStatus === undefined) continue;
      if (!assertV2StatusTransition(status, nextStatus, requirementId, next)) return false;
      status = nextStatus;
    }
    return true;
  }

  function validateV2ProjectStatusTransitions(currentState, events, next) {
    const statusByRequirement = new Map(
      (currentState.items || []).map((item) => [item.id, item.status])
    );
    for (const event of events) {
      const requirementId = event.requirementId;
      if (!requirementId) continue;
      if (event.kind === "req.new") {
        statusByRequirement.set(requirementId, event.status || "todo");
        continue;
      }
      const nextStatus = event.kind === "req.status" || event.kind === "req.patch"
        ? event.status
        : undefined;
      if (nextStatus === undefined) continue;
      const currentStatus = statusByRequirement.get(requirementId);
      if (!assertV2StatusTransition(currentStatus, nextStatus, requirementId, next)) return false;
      statusByRequirement.set(requirementId, nextStatus);
    }
    return true;
  }

  function validateV2ProjectRequirementReferences(currentState, events, next) {
    const requirementIds = new Set((currentState.items || []).map((item) => item.id));
    for (const event of events) {
      if (event.kind === "req.new") {
        if (requirementIds.has(event.requirementId)) {
          next(httpError(409, "REQUIREMENT_ALREADY_EXISTS", `需求已存在：${event.requirementId}`));
          return false;
        }
        requirementIds.add(event.requirementId);
        continue;
      }
      if (!requirementIds.has(event.requirementId)) {
        next(httpError(404, "REQUIREMENT_NOT_FOUND", `需求不存在：${event.requirementId}`));
        return false;
      }
    }
    return true;
  }

  function assertV2Title(value, next) {
    const title = String(value || "").trim();
    if (!title) {
      next(httpError(400, "MISSING_TITLE", "需求标题不能为空"));
      return null;
    }
    return title;
  }

  function isStringList(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  function assertV2Detail(value, next) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      next(httpError(400, "INVALID_DETAIL", "需求详情必须是对象"));
      return false;
    }
    for (const field of V2_DETAIL_STRING_FIELDS) {
      if (value[field] !== undefined && typeof value[field] !== "string") {
        next(httpError(400, "INVALID_DETAIL", `需求详情 ${field} 必须是字符串`));
        return false;
      }
    }
    for (const field of V2_DETAIL_STRING_LIST_FIELDS) {
      if (value[field] !== undefined && !isStringList(value[field])) {
        next(httpError(400, "INVALID_DETAIL", `需求详情 ${field} 必须是字符串数组`));
        return false;
      }
    }
    return true;
  }

  function assertV2Acceptance(value, next) {
    if (!isStringList(value)) {
      next(httpError(400, "INVALID_ACCEPTANCE", "需求验收点必须是字符串数组"));
      return false;
    }
    return true;
  }

  function validateRequirementScopedEvents(events, next) {
    for (const event of events) {
      if (!V2_REQUIREMENT_EVENT_KINDS.has(event.kind)) {
        next(httpError(400, "INVALID_REQUIREMENT_EVENT_KIND", "需求级事件仅支持 req.status、req.patch、note.add"));
        return false;
      }
      if (event.kind === "req.status") {
        if (event.status === undefined) {
          next(httpError(400, "MISSING_STATUS", "状态变更事件必须包含 status"));
          return false;
        }
        const status = assertV2Status(event.status, next);
        if (!status) return false;
      }
      if (event.kind === "req.patch") {
        if (event.title !== undefined && !assertV2Title(event.title, next)) return false;
        if (event.status !== undefined && !assertV2Status(event.status, next)) return false;
        if (event.priority !== undefined && !assertV2Priority(event.priority, next)) return false;
        if (event.detail !== undefined && !assertV2Detail(event.detail, next)) return false;
        if (event.acceptance !== undefined && !assertV2Acceptance(event.acceptance, next)) return false;
      }
      if (event.kind === "note.add" && !String(event.text || "").trim()) {
        next(httpError(400, "EMPTY_NOTE", "备注内容不能为空"));
        return false;
      }
    }
    return true;
  }

  function validateV2ProjectEvents(events, next) {
    for (const event of events) {
      if (!V2_PROJECT_EVENT_KINDS.has(event.kind)) {
        next(httpError(400, "INVALID_PROJECT_EVENT_KIND", "项目事件仅支持 req.new、req.status、req.patch、note.add"));
        return false;
      }
      if (!event.requirementId) {
        next(httpError(400, "MISSING_REQUIREMENT_ID", "项目事件必须包含 requirementId"));
        return false;
      }
      if (event.kind === "req.new") {
        if (!String(event.title || "").trim()) {
          next(httpError(400, "MISSING_TITLE", "新建需求事件必须包含标题"));
          return false;
        }
        if (event.status !== undefined && !assertV2Status(event.status, next)) return false;
        if (event.priority !== undefined && !assertV2Priority(event.priority, next)) return false;
      }
      if (event.kind === "req.status") {
        if (event.status === undefined) {
          next(httpError(400, "MISSING_STATUS", "状态变更事件必须包含 status"));
          return false;
        }
        if (!assertV2Status(event.status, next)) return false;
      }
      if (event.kind === "req.patch") {
        if (event.title !== undefined && !assertV2Title(event.title, next)) return false;
        if (event.status !== undefined && !assertV2Status(event.status, next)) return false;
        if (event.priority !== undefined && !assertV2Priority(event.priority, next)) return false;
        if (event.detail !== undefined && !assertV2Detail(event.detail, next)) return false;
        if (event.acceptance !== undefined && !assertV2Acceptance(event.acceptance, next)) return false;
      }
      if (event.kind === "note.add" && !String(event.text || "").trim()) {
        next(httpError(400, "EMPTY_NOTE", "备注内容不能为空"));
        return false;
      }
    }
    return true;
  }

  function getProjectState(rootDir, projectId) {
    const paths = projectPaths(rootDir, projectId);
    if (!fs.existsSync(paths.dataDir) && !fs.existsSync(paths.eventsPath) && !fs.existsSync(paths.legacyEventsJsonlPath)) {
      return null;
    }
    return render(paths);
  }

  router.get("/projects/:project/requirements", (req, res, next) => {
    const state = getProjectState(rootDir, req.params.project);
    if (!state) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    return res.json({
      ok: true,
      project: req.params.project,
      requirements: state.items || []
    });
  });

  router.post("/projects/:project/requirements", express.json(), (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.dataDir)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    const title = String(req.body.title || "").trim();
    if (!title) {
      return next(httpError(400, "MISSING_TITLE", "需求标题不能为空"));
    }
    const priority = assertV2Priority(req.body.priority, next);
    if (!priority) return;
    const status = assertV2Status(req.body.status, next);
    if (req.body.status !== undefined && !status) return;

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const state = getProjectState(rootDir, req.params.project) || { items: [] };
    const event = {
      kind: "req.new",
      actor,
      requirementId: nextRequirementId(state.items || []),
      title,
      summary: String(req.body.description || req.body.summary || "").trim(),
      priority,
      owner: req.body.owner !== undefined ? String(req.body.owner).trim() : undefined
    };
    if (status) event.status = status;

    const nextState = withLock(paths.lockPath, () => {
      const appended = appendEvents(paths.eventsPath, [event]);
      const rendered = render(paths);
      return { appended, rendered };
    });
    const requirement = nextState.rendered.items.find((item) => item.id === event.requirementId);
    return res.status(201).json({
      ok: true,
      project: paths.projectId,
      requirement,
      event: nextState.appended[0]
    });
  });

  router.get("/projects/:project/requirements/:requirementId", (req, res, next) => {
    const state = getProjectState(rootDir, req.params.project);
    if (!state) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    const requirement = (state.items || []).find((item) => item.id === req.params.requirementId);
    if (!requirement) {
      return next(httpError(404, "REQUIREMENT_NOT_FOUND", `需求不存在：${req.params.requirementId}`));
    }
    return res.json({
      ok: true,
      project: req.params.project,
      requirement
    });
  });

  router.patch("/projects/:project/requirements/:requirementId", express.json(), (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    const state = getProjectState(rootDir, req.params.project);
    if (!state) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    const currentRequirement = (state.items || []).find((item) => item.id === req.params.requirementId);
    if (!currentRequirement) {
      return next(httpError(404, "REQUIREMENT_NOT_FOUND", `需求不存在：${req.params.requirementId}`));
    }

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const events = [];
    const patch = {};
    if (req.body.title !== undefined) {
      const title = assertV2Title(req.body.title, next);
      if (!title) return;
      patch.title = title;
    }
    if (req.body.description !== undefined) patch.summary = String(req.body.description).trim();
    if (req.body.summary !== undefined) patch.summary = String(req.body.summary).trim();
    if (req.body.next !== undefined) patch.detail = { next: String(req.body.next).trim() };
    if (req.body.acceptance !== undefined) {
      if (!assertV2Acceptance(req.body.acceptance, next)) return;
      patch.acceptance = req.body.acceptance;
    }
    if (req.body.priority !== undefined) {
      const priority = assertV2Priority(req.body.priority, next);
      if (!priority) return;
      patch.priority = priority;
    }
    if (req.body.owner !== undefined) patch.owner = String(req.body.owner).trim();

    if (Object.keys(patch).length > 0) {
      events.push({
        kind: "req.patch",
        actor,
        requirementId: req.params.requirementId,
        ...patch
      });
    }
    if (req.body.status !== undefined) {
      const status = assertV2Status(req.body.status, next);
      if (!status) return;
      if (!assertV2StatusTransition(currentRequirement.status, status, req.params.requirementId, next)) return;
      events.push({
        kind: "req.status",
        actor,
        requirementId: req.params.requirementId,
        status
      });
    }
    if (events.length === 0) {
      return next(httpError(400, "EMPTY_PATCH", "没有可更新的需求字段"));
    }

    const nextState = withLock(paths.lockPath, () => {
      appendEvents(paths.eventsPath, events);
      return render(paths);
    });
    const requirement = nextState.items.find((item) => item.id === req.params.requirementId);
    return res.json({
      ok: true,
      project: paths.projectId,
      requirement,
      appended: events.length
    });
  });

  router.get("/projects/:project/state", (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath) && !fs.existsSync(paths.stateJsonPath)) {
      if (fs.existsSync(paths.dataDir)) {
        render(paths);
      } else {
        return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
      }
    }
    if (!fs.existsSync(paths.stateJsonPath)) {
      render(paths);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(paths.stateJsonPath).pipe(res);
  });

  router.get("/projects/:project/events", (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const kind = req.query.kind ? String(req.query.kind) : null;
    const requirementId = req.query.requirementId ? String(req.query.requirementId) : null;

    const all = readEvents(paths.eventsPath).reverse(); // newest-first
    const filtered = all.filter((event) => {
      const eventKind = event.kind || event.type;
      if (!V2_PROJECT_EVENT_KINDS.has(eventKind)) return false;
      if (kind && eventKind !== kind) return false;
      if (requirementId && event.requirementId !== requirementId) return false;
      return true;
    });

    const events = filtered.slice(offset, offset + limit).map((event) => ({
      eventId: event.eventId,
      ts: event.ts,
      kind: event.kind || event.type,
      actor: event.actor,
      requirementId: event.requirementId,
      taskId: event.taskId,
      status: event.status,
      title: event.title,
      summary: event.summary,
      text: event.text,
      at: event.at,
      updatedAt: event.updatedAt
    }));

    res.setHeader("Cache-Control", "no-store");
    return res.json({
      ok: true,
      project: paths.projectId,
      events,
      total: filtered.length,
      hasMore: offset + limit < filtered.length
    });
  });

  router.get("/projects/:project/requirements/:requirementId/events", (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    const state = getProjectState(rootDir, req.params.project);
    if (!state) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    if (!(state.items || []).some((item) => item.id === req.params.requirementId)) {
      return next(httpError(404, "REQUIREMENT_NOT_FOUND", `需求不存在：${req.params.requirementId}`));
    }
    const events = readEvents(paths.eventsPath)
      .filter((event) => {
        const kind = event.kind || event.type;
        return event.requirementId === req.params.requirementId && V2_REQUIREMENT_HISTORY_KINDS.has(kind);
      })
      .map((event) => ({
        eventId: event.eventId,
        ts: event.ts,
        kind: event.kind || event.type,
        actor: event.actor,
        requirementId: event.requirementId,
        taskId: event.taskId,
        updatedAt: event.updatedAt,
        at: event.at,
        event
      }));
    return res.json({ ok: true, project: paths.projectId, requirementId: req.params.requirementId, events });
  });

  router.post("/projects/:project/requirements/:requirementId/events", express.json(), (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    const state = getProjectState(rootDir, req.params.project);
    if (!state) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    const currentRequirement = (state.items || []).find((item) => item.id === req.params.requirementId);
    if (!currentRequirement) {
      return next(httpError(404, "REQUIREMENT_NOT_FOUND", `需求不存在：${req.params.requirementId}`));
    }

    const body = req.body;
    const list = Array.isArray(body.events)
      ? body.events
      : Array.isArray(body)
        ? body
        : [body];

    if (list.length === 0) {
      return next(httpError(400, "EMPTY_EVENTS", "事件列表为空"));
    }
    if (list.some((event) => event.requirementId && event.requirementId !== req.params.requirementId)) {
      return next(httpError(400, "REQUIREMENT_EVENT_MISMATCH", "事件 requirementId 与路径不一致"));
    }
    if (!validateRequirementScopedEvents(list, next)) return;
    if (!validateV2StatusTransitions(currentRequirement.status, list, req.params.requirementId, next)) return;

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const stamped = list.map((event) => ({
      ...event,
      text: event.kind === "note.add" ? String(event.text || "").trim() : event.text,
      requirementId: req.params.requirementId,
      actor: event.actor || actor
    }));

    const result = withLock(paths.lockPath, () => {
      const appended = appendEvents(paths.eventsPath, stamped);
      const rendered = render(paths);
      return { appended, rendered };
    });
    const requirement = result.rendered.items.find((item) => item.id === req.params.requirementId);

    return res.status(201).json({
      ok: true,
      project: paths.projectId,
      requirementId: req.params.requirementId,
      appended: result.appended.length,
      events: result.appended,
      requirement
    });
  });

  router.post("/projects/:project/events", express.json({ limit: "10mb" }), (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.dataDir)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }

    const body = req.body;
    const list = Array.isArray(body.events)
      ? body.events
      : Array.isArray(body)
        ? body
        : [body];

    if (list.length === 0) {
      return next(httpError(400, "EMPTY_EVENTS", "事件列表为空"));
    }
    if (!validateV2ProjectEvents(list, next)) return;
    const currentState = getProjectState(rootDir, req.params.project) || { items: [] };
    if (!validateV2ProjectRequirementReferences(currentState, list, next)) return;
    if (!validateV2ProjectStatusTransitions(currentState, list, next)) return;

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const stamped = list.map((e) => ({
      ...e,
      text: e.kind === "note.add" ? String(e.text || "").trim() : e.text,
      actor: e.actor || actor
    }));
    const state = withLock(paths.lockPath, () => {
      appendEvents(paths.eventsPath, stamped);
      return render(paths);
    });
    return res.json({ ok: true, appended: stamped.length, items: state.items.length, updatedAt: state.updatedAt });
  });

  router.post("/projects/:project/render", (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    const state = withLock(paths.lockPath, () => render(paths));
    return res.json({ ok: true, items: state.items.length, updatedAt: state.updatedAt });
  });

  return router;
}

module.exports = { createRoutes };
