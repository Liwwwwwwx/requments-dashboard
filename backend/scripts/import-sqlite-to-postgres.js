#!/usr/bin/env node
"use strict";

/** One-time, additive import from the current SQLite data directory into PostgreSQL. */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { Client } = require("pg");

const rootDir = process.env.REQUIREMENTS_ROOT || path.resolve(__dirname, "..", "..");
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const dataDir = path.join(rootDir, "data");
const dryRun = process.argv.includes("--dry-run");

if (!databaseUrl) {
  console.error("DATABASE_URL is required. No data was imported.");
  process.exit(1);
}

function openIfPresent(filePath) {
  return fs.existsSync(filePath) ? new Database(filePath, { readonly: true }) : null;
}

function rows(db, sql) {
  return db ? db.prepare(sql).all() : [];
}

function hasTable(db, name) {
  return Boolean(db?.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function projectIds() {
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir).filter((name) => {
    const fullPath = path.join(dataDir, name);
    return fs.statSync(fullPath).isDirectory()
      && /^[a-zA-Z0-9_-]+$/.test(name)
      && fs.existsSync(path.join(fullPath, "events.db"));
  });
}

async function main() {
  const usersDb = openIfPresent(path.join(dataDir, "users.db"));
  const projectsDb = openIfPresent(path.join(dataDir, "projects.db"));
  const users = rows(usersDb, "SELECT id, username, password_hash, role, display_name, created_at FROM users");
  const projectRows = rows(projectsDb, "SELECT id, name, description, created_at, updated_at FROM projects");
  usersDb?.close();
  projectsDb?.close();

  const projectsById = new Map(projectRows.map((project) => [project.id, project]));
  const projects = projectIds().map((id) => projectsById.get(id) || {
    id,
    name: id,
    description: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const events = [];
  const conversations = [];
  const messages = [];
  const proposals = [];
  for (const project of projects) {
    const db = openIfPresent(path.join(dataDir, project.id, "events.db"));
    for (const event of rows(db, "SELECT id, ts, kind, project, requirement_id, task_id, actor, payload FROM events ORDER BY ts, rowid")) {
      events.push({ ...event, project_id: project.id });
    }
    if (hasTable(db, "ai_conversations")) {
      conversations.push(...rows(db, "SELECT * FROM ai_conversations"));
      messages.push(...rows(db, "SELECT * FROM ai_messages"));
      proposals.push(...rows(db, "SELECT * FROM ai_proposals"));
    }
    db?.close();
  }

  const accountsPath = path.join(dataDir, "ai-usage", "accounts.json");
  const accounts = fs.existsSync(accountsPath)
    ? JSON.parse(fs.readFileSync(accountsPath, "utf8"))
    : [];

  console.log(
    `Found ${users.length} users, ${projects.length} projects, ${events.length} events, `
      + `${conversations.length} conversations, ${messages.length} messages, ${proposals.length} proposals.`
  );
  if (dryRun) return;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const existing = await client.query("SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM projects) + (SELECT count(*) FROM events) AS count");
    if (Number(existing.rows[0].count) > 0) {
      throw new Error("PostgreSQL already contains application data; import aborted to prevent duplicates.");
    }
    await client.query("BEGIN");
    for (const user of users) {
      await client.query(
        "INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
        [user.id, user.username, user.password_hash, user.role || "member", user.display_name, user.created_at]
      );
    }
    for (const project of projects) {
      await client.query(
        "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)",
        [project.id, project.name, project.description || "", project.created_at, project.updated_at]
      );
    }
    const owner = users.find((user) => user.role === "owner") || users[0];
    if (owner) {
      for (const project of projects) {
        await client.query(
          "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')",
          [project.id, owner.id]
        );
      }
    }
    for (const event of events) {
      await client.query(
        "INSERT INTO events (id, ts, kind, project_id, requirement_id, task_id, actor, payload) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
        [event.id, event.ts, event.kind, event.project_id, event.requirement_id, event.task_id, event.actor, event.payload]
      );
    }
    for (const account of accounts) {
      await client.query(
        "INSERT INTO ai_accounts (id, provider, account_name, base_url, model_id, extra_headers_json, enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)",
        [
          account.id,
          account.provider,
          account.accountName,
          account.baseUrl,
          account.modelId || "",
          account.extraHeadersJson || null,
          account.enabled !== false,
          account.createdAt || new Date().toISOString(),
          account.updatedAt || new Date().toISOString()
        ]
      );
    }
    for (const conversation of conversations) {
      await client.query(
        "INSERT INTO ai_conversations (id, user_id, project_id, requirement_id, title, model, account_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [conversation.id, conversation.user_id, conversation.project_id, conversation.requirement_id, conversation.title, conversation.model, conversation.account_id, conversation.created_at, conversation.updated_at]
      );
    }
    for (const message of messages) {
      await client.query(
        "INSERT INTO ai_messages (id, conversation_id, role, content, tool_calls, tokens_in, tokens_out, ts) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)",
        [message.id, message.conversation_id, message.role, message.content, message.tool_calls, message.tokens_in || 0, message.tokens_out || 0, message.ts]
      );
    }
    for (const proposal of proposals) {
      await client.query(
        "INSERT INTO ai_proposals (id, conversation_id, message_id, events_json, status, applied_at, applied_by, created_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)",
        [proposal.id, proposal.conversation_id, proposal.message_id, proposal.events_json, proposal.status, proposal.applied_at, proposal.applied_by, proposal.created_at]
      );
    }
    await client.query("COMMIT");
    console.log("SQLite data imported successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
