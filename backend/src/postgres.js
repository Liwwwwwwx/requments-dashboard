"use strict";

const { Pool } = require("pg");

let pool;

function databaseUrl() {
  return String(process.env.DATABASE_URL || "").trim();
}

function isPostgresEnabled() {
  return Boolean(databaseUrl());
}

function getPool() {
  if (!isPostgresEnabled()) {
    throw new Error("DATABASE_URL is required for PostgreSQL access");
  }
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl() });
  }
  return pool;
}

async function query(text, values) {
  return getPool().query(text, values);
}

module.exports = { isPostgresEnabled, getPool, query };
