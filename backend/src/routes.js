"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const { projectPaths, listProjects, ensureProject, isValidProjectId } = require("./projects");
const { readEvents, appendEvents, withLock } = require("./events");
const { render } = require("./state");

function createRoutes(rootDir) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "requirements-board-backend", dataDir: path.join(rootDir, "data") });
  });

  router.get("/projects", (_req, res) => {
    const projects = listProjects(rootDir).map((id) => ({ id, name: id }));
    res.json({ ok: true, projects });
  });

  router.post("/projects", express.json(), (req, res) => {
    const id = String(req.body.id || "").trim();
    if (!id || !isValidProjectId(id)) {
      return res.status(400).json({ ok: false, error: "INVALID_PROJECT_ID" });
    }
    const paths = ensureProject(rootDir, id);
    return res.json({ ok: true, project: { id, dataDir: paths.dataDir } });
  });

  router.get("/projects/:project/state", (req, res) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath) && !fs.existsSync(paths.stateJsonPath)) {
      return res.status(404).json({ ok: false, error: "PROJECT_NOT_FOUND" });
    }
    if (!fs.existsSync(paths.stateJsonPath)) {
      render(paths);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(paths.stateJsonPath).pipe(res);
  });

  router.get("/projects/:project/events", (req, res) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath)) {
      return res.status(404).json({ ok: false, error: "PROJECT_NOT_FOUND" });
    }
    res.setHeader("Content-Type", "application/jsonl; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(paths.eventsPath).pipe(res);
  });

  router.post("/projects/:project/events", express.json({ limit: "10mb" }), (req, res) => {
    const paths = projectPaths(rootDir, req.params.project);
    ensureProject(rootDir, req.params.project);

    const body = req.body;
    const list = Array.isArray(body.events)
      ? body.events
      : Array.isArray(body)
        ? body
        : [body];

    if (list.length === 0) {
      return res.status(400).json({ ok: false, error: "EMPTY_EVENTS" });
    }

    try {
      const actor = req.headers["x-actor"] || req.socket.remoteAddress || "http";
      const stamped = list.map((e) => ({ ...e, actor: e.actor || actor }));
      const state = withLock(paths.lockPath, () => {
        appendEvents(paths.eventsPath, stamped);
        return render(paths);
      });
      return res.json({ ok: true, appended: stamped.length, items: state.items.length, updatedAt: state.updatedAt });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/projects/:project/render", (req, res) => {
    const paths = projectPaths(rootDir, req.params.project);
    if (!fs.existsSync(paths.eventsPath)) {
      return res.status(404).json({ ok: false, error: "PROJECT_NOT_FOUND" });
    }
    try {
      const state = withLock(paths.lockPath, () => render(paths));
      return res.json({ ok: true, items: state.items.length, updatedAt: state.updatedAt });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createRoutes };
