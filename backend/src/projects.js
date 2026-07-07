"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const PROJECT_ID_RE = /^[a-zA-Z0-9_-]+$/;
const projectDbs = new Map();

const PROJECT_SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
`;

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

function projectDb(rootDir) {
  const dataDir = path.join(rootDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "projects.db");
  if (!projectDbs.has(dbPath)) {
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(PROJECT_SCHEMA);
    projectDbs.set(dbPath, db);
  }
  return projectDbs.get(dbPath);
}

function toProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function ensureProjectMetadata(rootDir, projectId, input = {}) {
  const id = sanitizeProjectId(projectId);
  const db = projectDb(rootDir);
  const existing = db.prepare("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?").get(id);
  if (existing) {
    if (input.name !== undefined || input.description !== undefined) {
      const now = new Date().toISOString();
      db.prepare("UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?").run(
        input.name !== undefined ? String(input.name).trim() || id : existing.name,
        input.description !== undefined ? String(input.description).trim() : existing.description,
        now,
        id
      );
      return getProjectMetadata(rootDir, id);
    }
    return toProject(existing);
  }

  const now = new Date().toISOString();
  db.prepare("INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    input.name !== undefined ? String(input.name).trim() || id : id,
    input.description !== undefined ? String(input.description).trim() : "",
    now,
    now
  );
  return getProjectMetadata(rootDir, id);
}

function getProjectMetadata(rootDir, projectId) {
  const id = sanitizeProjectId(projectId);
  const db = projectDb(rootDir);
  return toProject(db.prepare("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = ?").get(id));
}

function getProject(rootDir, projectId) {
  const paths = projectPaths(rootDir, projectId);
  if (!fs.existsSync(paths.dataDir)) return null;
  return ensureProjectMetadata(rootDir, paths.projectId);
}

function listProjectDetails(rootDir) {
  return listProjects(rootDir).map((id) => ensureProjectMetadata(rootDir, id));
}

function updateProject(rootDir, projectId, input = {}) {
  const paths = projectPaths(rootDir, projectId);
  if (!fs.existsSync(paths.dataDir)) return null;
  return ensureProjectMetadata(rootDir, paths.projectId, input);
}

module.exports = {
  projectPaths,
  listProjects,
  listProjectDetails,
  ensureProject,
  ensureProjectMetadata,
  getProject,
  updateProject,
  isValidProjectId,
  sanitizeProjectId
};
