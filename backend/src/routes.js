"use strict";

const { createPostgresRoutes } = require("./postgres-routes");

/** PostgreSQL is the sole application storage backend. */
function createRoutes(rootDir) {
  return createPostgresRoutes(rootDir);
}

module.exports = { createRoutes };
