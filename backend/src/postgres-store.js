"use strict";

const { query } = require("./postgres");
const { validateEvent } = require("./schema");

function createEventId() {
  return `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toProject(row) {
  return row && {
    id: row.id,
    name: row.name,
    description: row.description || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listProjects(userId) {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.created_at, p.updated_at
     FROM projects p
     JOIN project_members m ON m.project_id = p.id
     WHERE m.user_id = $1
     ORDER BY p.updated_at DESC, p.id ASC`,
    [userId]
  );
  return result.rows.map(toProject);
}

async function getProject(projectId, userId) {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.created_at, p.updated_at
     FROM projects p
     JOIN project_members m ON m.project_id = p.id
     WHERE p.id = $1 AND m.user_id = $2`,
    [projectId, userId]
  );
  return toProject(result.rows[0]);
}

async function getProjectById(projectId) {
  const result = await query("SELECT id, name, description, created_at, updated_at FROM projects WHERE id = $1", [projectId]);
  return toProject(result.rows[0]);
}

async function createProject(input, userId) {
  const now = new Date().toISOString();
  const project = await query(
    `INSERT INTO projects (id, name, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING id, name, description, created_at, updated_at`,
    [input.id, input.name || input.id, input.description || "", now]
  );
  await query(
    "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')",
    [input.id, userId]
  );
  return toProject(project.rows[0]);
}

async function updateProject(projectId, input) {
  const result = await query(
    `UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = now()
     WHERE id = $1 RETURNING id, name, description, created_at, updated_at`,
    [projectId, input.name, input.description]
  );
  return toProject(result.rows[0]);
}

async function listEvents(projectId) {
  const result = await query(
    "SELECT payload FROM events WHERE project_id = $1 ORDER BY ts ASC, id ASC",
    [projectId]
  );
  return result.rows.map((row) => row.payload);
}

async function appendEvents(projectId, input) {
  const list = Array.isArray(input) ? input : [input];
  const normalized = list.map((event) => validateEvent({
    eventId: event.eventId || createEventId(),
    ts: event.ts || Date.now(),
    project: projectId,
    ...event
  }));
  for (const event of normalized) {
    await query(
      `INSERT INTO events (id, ts, kind, project_id, requirement_id, task_id, actor, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [event.eventId, event.ts, event.kind, projectId, event.requirementId || null, event.taskId || null, event.actor || null, JSON.stringify(event)]
    );
  }
  return normalized;
}

module.exports = {
  listProjects,
  getProject,
  getProjectById,
  createProject,
  updateProject,
  listEvents,
  appendEvents
};
