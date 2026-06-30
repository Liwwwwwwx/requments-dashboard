"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ID_RE = /^[a-zA-Z0-9_-]+$/;

function sanitizeProjectId(id) {
  return String(id || "default").replace(/[^a-zA-Z0-9_-]/g, "");
}

function isValidProjectId(id) {
  return PROJECT_ID_RE.test(String(id));
}

function projectPaths(rootDir, projectId) {
  const safeId = sanitizeProjectId(projectId);
  const dataDir = path.join(rootDir, "data", safeId);
  return {
    projectId: safeId,
    dataDir,
    eventsPath: path.join(dataDir, "events.db"),
    legacyEventsJsonlPath: path.join(dataDir, "events.jsonl"),
    stateJsonPath: path.join(dataDir, "state.json"),
    lockPath: path.join(dataDir, ".requirements.lock")
  };
}

function listProjects(rootDir) {
  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir)
    .filter((name) => {
      const full = path.join(dataDir, name);
      return fs.statSync(full).isDirectory() && isValidProjectId(name);
    })
    .sort();
}

function ensureProject(rootDir, projectId) {
  const paths = projectPaths(rootDir, projectId);
  fs.mkdirSync(paths.dataDir, { recursive: true });
  return paths;
}

module.exports = {
  projectPaths,
  listProjects,
  ensureProject,
  isValidProjectId,
  sanitizeProjectId
};
