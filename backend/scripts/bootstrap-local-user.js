#!/usr/bin/env node
"use strict";

const bcrypt = require("bcryptjs");
const { Client } = require("pg");

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM users LIMIT 1");
    if (existing.rowCount > 0) {
      console.log("Local user bootstrap skipped: users already exist.");
      return;
    }
    const username = process.env.LOCAL_ADMIN_USERNAME || "admin";
    const password = process.env.LOCAL_ADMIN_PASSWORD || "admin123";
    const id = `local-admin-${Date.now()}`;
    await client.query(
      "INSERT INTO users (id, username, password_hash, role, display_name) VALUES ($1, $2, $3, 'owner', '本地管理员')",
      [id, username, bcrypt.hashSync(password, 12)]
    );
    console.log(`Created local owner account: ${username}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
