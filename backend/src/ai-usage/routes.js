"use strict";

const express = require("express");
const { buildState, upsertAccount, appendSnapshot } = require("./store");
const { syncAccount, testConnection } = require("./sync");
const { httpError } = require("../errors");

function createAiUsageRoutes(rootDir) {
  const router = express.Router();

  router.get("/state", (_req, res, next) => {
    try {
      return res.json(buildState(rootDir));
    } catch (err) {
      next(httpError(500, "AI_USAGE_STATE_FAILED", err.message));
    }
  });

  router.post("/accounts", express.json(), (req, res, next) => {
    try {
      const account = upsertAccount(rootDir, req.body || {});
      return res.json({ ok: true, account, state: buildState(rootDir) });
    } catch (err) {
      next(httpError(400, "AI_USAGE_ACCOUNT_INVALID", err.message));
    }
  });

  router.post("/test", express.json(), async (req, res, next) => {
    try {
      const result = await testConnection(rootDir, req.body || {});
      return res.json(result);
    } catch (err) {
      next(httpError(400, "AI_USAGE_TEST_FAILED", err.message));
    }
  });

  router.post("/snapshots", express.json(), (req, res, next) => {
    try {
      const snapshot = appendSnapshot(rootDir, req.body || {});
      return res.json({ ok: true, snapshot, state: buildState(rootDir) });
    } catch (err) {
      next(httpError(400, "AI_USAGE_SNAPSHOT_INVALID", err.message));
    }
  });

  router.post("/accounts/:accountId/sync", express.json(), async (req, res, next) => {
    try {
      const result = await syncAccount(rootDir, req.params.accountId);
      return res.json({ ok: true, ...result, state: buildState(rootDir) });
    } catch (err) {
      next(httpError(400, "AI_USAGE_SYNC_FAILED", err.message));
    }
  });

  return router;
}

module.exports = { createAiUsageRoutes };