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
const { httpError } = require("./errors");
const { createAuthRoutes } = require("./auth/routes");
const { authMiddleware } = require("./auth/middleware");
const { initUsers } = require("./auth/users");
const { createAiRoutes } = require("./ai/routes");

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

  router.get("/projects", (_req, res) => {
    const projects = listProjectDetails(rootDir);
    res.json({ ok: true, projects });
  });

  router.post("/projects", express.json(), (req, res, next) => {
    const id = String(req.body.id || "").trim();
    if (!id || !isValidProjectId(id)) {
      return next(httpError(400, "INVALID_PROJECT_ID", `项目 id 非法：${id}`));
    }
    const paths = ensureProject(rootDir, id);
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

  function getProjectState(rootDir, projectId) {
    const paths = projectPaths(rootDir, projectId);
    if (!fs.existsSync(paths.eventsPath) && !fs.existsSync(paths.stateJsonPath)) {
      if (fs.existsSync(paths.dataDir)) {
        return render(paths);
      }
      return null;
    }
    if (!fs.existsSync(paths.stateJsonPath)) {
      return render(paths);
    }
    try {
      return JSON.parse(fs.readFileSync(paths.stateJsonPath, "utf8"));
    } catch (_err) {
      return render(paths);
    }
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
    const paths = ensureProject(rootDir, req.params.project);
    const title = String(req.body.title || "").trim();
    if (!title) {
      return next(httpError(400, "MISSING_TITLE", "需求标题不能为空"));
    }

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const state = getProjectState(rootDir, req.params.project) || { items: [] };
    const event = {
      kind: "req.new",
      actor,
      requirementId: nextRequirementId(state.items || []),
      title,
      summary: String(req.body.description || req.body.summary || "").trim(),
      priority: req.body.priority || "P1",
      owner: req.body.owner
    };

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
    if (!(state.items || []).some((item) => item.id === req.params.requirementId)) {
      return next(httpError(404, "REQUIREMENT_NOT_FOUND", `需求不存在：${req.params.requirementId}`));
    }

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const events = [];
    const patch = {};
    if (req.body.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body.description !== undefined) patch.summary = String(req.body.description).trim();
    if (req.body.summary !== undefined) patch.summary = String(req.body.summary).trim();
    if (req.body.priority !== undefined) patch.priority = req.body.priority;
    if (req.body.owner !== undefined) patch.owner = req.body.owner;

    if (Object.keys(patch).length > 0) {
      events.push({
        kind: "req.patch",
        actor,
        requirementId: req.params.requirementId,
        ...patch
      });
    }
    if (req.body.status !== undefined) {
      events.push({
        kind: "req.status",
        actor,
        requirementId: req.params.requirementId,
        status: req.body.status
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
      if (kind && (event.kind || event.type) !== kind) return false;
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
    if (!fs.existsSync(paths.eventsPath)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
    }
    const events = readEvents(paths.eventsPath)
      .filter((event) => event.requirementId === req.params.requirementId)
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
    if (!(state.items || []).some((item) => item.id === req.params.requirementId)) {
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
    if (list.some((event) => event.kind === "note.add" && !String(event.text || "").trim())) {
      return next(httpError(400, "EMPTY_NOTE", "备注内容不能为空"));
    }

    const actor = req.headers["x-actor"] || req.user?.username || "http";
    const stamped = list.map((event) => ({
      ...event,
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
    ensureProject(rootDir, req.params.project);

    const body = req.body;
    const list = Array.isArray(body.events)
      ? body.events
      : Array.isArray(body)
        ? body
        : [body];

    if (list.length === 0) {
      return next(httpError(400, "EMPTY_EVENTS", "事件列表为空"));
    }

    const actor = req.headers["x-actor"] || req.socket.remoteAddress || "http";
    const stamped = list.map((e) => ({ ...e, actor: e.actor || actor }));
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
