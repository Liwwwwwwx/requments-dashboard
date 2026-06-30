"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const { projectPaths, listProjects, ensureProject, isValidProjectId } = require("./projects");
const { readEvents, appendEvents, withLock } = require("./events");
const { render } = require("./state");
const { httpError } = require("./errors");
const { createAuthRoutes } = require("./auth/routes");
const { authMiddleware } = require("./auth/middleware");
const { initUsers } = require("./auth/users");

function createRoutes(rootDir) {
  const router = express.Router();

  const dbPath = path.join(rootDir, "data", "users.db");
  const users = initUsers(dbPath);

  router.use(createAuthRoutes(rootDir));

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "requirements-board-backend", dataDir: path.join(rootDir, "data") });
  });

  router.use(authMiddleware(users));

  router.get("/projects", (_req, res) => {
    const projects = listProjects(rootDir).map((id) => ({ id, name: id }));
    res.json({ ok: true, projects });
  });

  router.post("/projects", express.json(), (req, res, next) => {
    const id = String(req.body.id || "").trim();
    if (!id || !isValidProjectId(id)) {
      return next(httpError(400, "INVALID_PROJECT_ID", `项目 id 非法：${id}`));
    }
    const paths = ensureProject(rootDir, id);
    return res.json({ ok: true, project: { id, dataDir: paths.dataDir } });
  });

  router.get("/projects/:project/state", (req, res, next) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath) && !fs.existsSync(paths.stateJsonPath)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${req.params.project}`));
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
    res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(paths.eventsPath).pipe(res);
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