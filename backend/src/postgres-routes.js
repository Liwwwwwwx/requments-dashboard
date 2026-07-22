"use strict";

const express = require("express");
const { createAuthRoutes } = require("./auth/routes");
const { authMiddleware } = require("./auth/middleware");
const { initUsers } = require("./auth/users");
const store = require("./postgres-store");
const { buildState } = require("./state");
const { httpError } = require("./errors");
const { assertRequirementTransition } = require("./state-machine");
const { createAiRoutes } = require("./ai/routes");

const STATUSES = new Set(["todo", "doing", "blocked", "done"]);
const PRIORITIES = new Set(["P0", "P1", "P2"]);
const PROJECT_ID = /^[a-zA-Z0-9_-]+$/;

function stateFor(projectId) {
  return store.listEvents(projectId).then(buildState);
}

function projectId(req, next) {
  const id = String(req.params.project || "");
  if (!PROJECT_ID.test(id)) {
    next(httpError(400, "INVALID_PROJECT_ID", `项目 id 非法：${id}`));
    return null;
  }
  return id;
}

async function requireProject(req, next) {
  const id = projectId(req, next);
  if (!id) return null;
  const project = await store.getProject(id, req.user.id);
  if (!project) {
    next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${id}`));
    return null;
  }
  return project;
}

function nextRequirementId(items) {
  const max = items.reduce((value, item) => {
    const match = String(item.id).match(/^REQ-(\d+)$/);
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `REQ-${String(max + 1).padStart(4, "0")}`;
}

function validStatus(value, next) {
  if (value === undefined) return undefined;
  if (!STATUSES.has(String(value))) {
    next(httpError(400, "INVALID_STATUS", "需求状态仅支持 todo、doing、blocked、done"));
    return null;
  }
  return String(value);
}

function validPriority(value, next) {
  if (value === undefined) return undefined;
  if (!PRIORITIES.has(String(value))) {
    next(httpError(400, "INVALID_PRIORITY", "需求优先级仅支持 P0、P1、P2"));
    return null;
  }
  return String(value);
}

function createPostgresRoutes(rootDir) {
  const router = express.Router();
  const users = initUsers(require("path").join(rootDir, "data", "users.db"));
  router.use(createAuthRoutes(rootDir));
  router.get("/health", (_req, res) => res.json({ ok: true, service: "requirements-board-backend", storage: "postgres" }));
  router.use(authMiddleware(users));
  router.use("/ai", createAiRoutes(rootDir));
  router.get("/projects", async (req, res, next) => {
    try { res.json({ ok: true, projects: await store.listProjects(req.user.id) }); } catch (error) { next(error); }
  });
  router.post("/projects", express.json(), async (req, res, next) => {
    try {
      const id = String(req.body.id || "").trim();
      if (!PROJECT_ID.test(id)) return next(httpError(400, "INVALID_PROJECT_ID", `项目 id 非法：${id}`));
      const project = await store.createProject({ id, name: String(req.body.name || "").trim() || id, description: String(req.body.description || "").trim() }, req.user.id);
      res.status(201).json({ ok: true, project });
    } catch (error) {
      if (error.code === "23505") return next(httpError(409, "PROJECT_ALREADY_EXISTS", "项目已存在"));
      next(error);
    }
  });
  router.get("/projects/:project", async (req, res, next) => {
    try { const project = await requireProject(req, next); if (project) res.json({ ok: true, project }); } catch (error) { next(error); }
  });
  router.patch("/projects/:project", express.json(), async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      if (req.body.name !== undefined && !String(req.body.name).trim()) return next(httpError(400, "MISSING_PROJECT_NAME", "项目名称不能为空"));
      res.json({ ok: true, project: await store.updateProject(project.id, { name: req.body.name === undefined ? undefined : String(req.body.name).trim(), description: req.body.description === undefined ? undefined : String(req.body.description).trim() }) });
    } catch (error) { next(error); }
  });
  router.delete("/projects/:project", async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      if (project.role !== "owner") return next(httpError(403, "PROJECT_DELETE_FORBIDDEN", "仅项目 owner 可以删除项目"));
      const deleted = await store.deleteProject(project.id);
      res.json({ ok: true, project: project.id, deleted });
    } catch (error) { next(error); }
  });

  router.get("/projects/:project/requirements", async (req, res, next) => {
    try { const project = await requireProject(req, next); if (project) res.json({ ok: true, project: project.id, requirements: (await stateFor(project.id)).items }); } catch (error) { next(error); }
  });
  router.post("/projects/:project/requirements", express.json(), async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      const title = String(req.body.title || "").trim(); if (!title) return next(httpError(400, "MISSING_TITLE", "需求标题不能为空"));
      const priority = validPriority(req.body.priority, next); if (priority === null) return;
      const status = validStatus(req.body.status, next); if (status === null) return;
      const current = await stateFor(project.id);
      const detail = {};
      if (req.body.goal !== undefined) detail.goal = String(req.body.goal).trim();
      if (req.body.next !== undefined) detail.next = String(req.body.next).trim();
      const event = { kind: "req.new", requirementId: nextRequirementId(current.items), title, summary: String(req.body.description || req.body.summary || "").trim(), priority: priority || "P1", status: status || "todo", owner: req.body.owner === undefined ? undefined : String(req.body.owner).trim(), detail: Object.keys(detail).length ? detail : undefined, actor: req.user.username };
      const appended = await store.appendEvents(project.id, event);
      const state = await stateFor(project.id);
      res.status(201).json({ ok: true, project: project.id, requirement: state.items.find((item) => item.id === event.requirementId), event: appended[0] });
    } catch (error) { next(error); }
  });
  router.get("/projects/:project/requirements/:requirementId", async (req, res, next) => {
    try { const project = await requireProject(req, next); if (!project) return; const requirement = (await stateFor(project.id)).items.find((item) => item.id === req.params.requirementId); if (!requirement) return next(httpError(404, "REQUIREMENT_NOT_FOUND", "需求不存在")); res.json({ ok: true, project: project.id, requirement }); } catch (error) { next(error); }
  });
  router.patch("/projects/:project/requirements/:requirementId", express.json(), async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      const current = (await stateFor(project.id)).items.find((item) => item.id === req.params.requirementId); if (!current) return next(httpError(404, "REQUIREMENT_NOT_FOUND", "需求不存在"));
      const status = validStatus(req.body.status, next); if (status === null) return; const priority = validPriority(req.body.priority, next); if (priority === null) return;
      const patch = {}; ["title", "summary", "owner", "week", "dueDate", "acceptance"].forEach((key) => { if (req.body[key] !== undefined) patch[key] = req.body[key]; });
      if (req.body.description !== undefined) patch.summary = String(req.body.description).trim();
      const detail = {};
      if (req.body.goal !== undefined) detail.goal = String(req.body.goal).trim();
      if (req.body.next !== undefined) detail.next = String(req.body.next).trim();
      if (Object.keys(detail).length) patch.detail = detail;
      if (priority) patch.priority = priority;
      const events = Object.keys(patch).length ? [{ kind: "req.patch", requirementId: current.id, actor: req.user.username, ...patch }] : [];
      if (status) { assertRequirementTransition(current.status, status, current.id); events.push({ kind: "req.status", requirementId: current.id, status, actor: req.user.username }); }
      if (!events.length) return next(httpError(400, "EMPTY_PATCH", "没有可更新的需求字段"));
      await store.appendEvents(project.id, events); const state = await stateFor(project.id); res.json({ ok: true, project: project.id, requirement: state.items.find((item) => item.id === current.id), appended: events.length });
    } catch (error) { next(error); }
  });
  router.delete("/projects/:project/requirements/:requirementId", async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      const current = (await stateFor(project.id)).items.find((item) => item.id === req.params.requirementId);
      if (!current) return next(httpError(404, "REQUIREMENT_NOT_FOUND", "需求不存在"));
      const [event] = await store.appendEvents(project.id, { kind: "req.delete", requirementId: current.id, actor: req.user.username });
      res.json({ ok: true, project: project.id, requirementId: current.id, deleted: true, event });
    } catch (error) { next(error); }
  });
  router.get("/projects/:project/requirements/:requirementId/events", async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      const state = await stateFor(project.id);
      if (!state.items.some((item) => item.id === req.params.requirementId)) return next(httpError(404, "REQUIREMENT_NOT_FOUND", "需求不存在"));
      const events = (await store.listEvents(project.id)).filter((event) => event.requirementId === req.params.requirementId && ["req.new", "req.status", "req.patch", "req.delete", "note.add"].includes(event.kind)).map((event) => ({ eventId: event.eventId, ts: event.ts, kind: event.kind, actor: event.actor, requirementId: event.requirementId, taskId: event.taskId, updatedAt: event.updatedAt, at: event.at, event }));
      res.json({ ok: true, project: project.id, requirementId: req.params.requirementId, events });
    } catch (error) { next(error); }
  });
  router.post("/projects/:project/requirements/:requirementId/events", express.json(), async (req, res, next) => {
    try {
      const project = await requireProject(req, next); if (!project) return;
      const state = await stateFor(project.id);
      const current = state.items.find((item) => item.id === req.params.requirementId);
      if (!current) return next(httpError(404, "REQUIREMENT_NOT_FOUND", "需求不存在"));
      const list = Array.isArray(req.body?.events) ? req.body.events : Array.isArray(req.body) ? req.body : [req.body];
      if (!list.length || list.some((event) => !event || !["req.status", "req.patch", "note.add"].includes(event.kind))) return next(httpError(400, "INVALID_REQUIREMENT_EVENT_KIND", "需求级事件仅支持 req.status、req.patch、note.add"));
      let status = current.status;
      for (const event of list) {
        if (event.kind === "note.add" && !String(event.text || "").trim()) return next(httpError(400, "EMPTY_NOTE", "备注内容不能为空"));
        if ((event.kind === "req.status" || event.kind === "req.patch") && event.status !== undefined) { const value = validStatus(event.status, next); if (!value) return; assertRequirementTransition(status, value, current.id); status = value; }
      }
      const events = list.map((event) => ({ ...event, requirementId: current.id, actor: event.actor || req.user.username, text: event.kind === "note.add" ? String(event.text).trim() : event.text }));
      const appended = await store.appendEvents(project.id, events); const nextState = await stateFor(project.id);
      res.status(201).json({ ok: true, project: project.id, requirementId: current.id, appended: appended.length, events: appended, requirement: nextState.items.find((item) => item.id === current.id) });
    } catch (error) { next(error); }
  });
  return router;
}

module.exports = { createPostgresRoutes };
