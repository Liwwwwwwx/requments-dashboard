#!/usr/bin/env node
"use strict";

/** Execute PostgreSQL migrations in lexical order and record each applied file. */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required. No migration was run.");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const directory = path.join(__dirname, "..", "migrations");
    const files = fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (applied.rowCount) continue;
      const sql = fs.readFileSync(path.join(directory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
