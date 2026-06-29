"use strict";

const express = require("express");
const path = require("path");
const { buildState, upsertAccount, appendSnapshot } = require("./store");
const { syncAccount, testConnection } = require("./sync");

function createAiUsageRoutes(rootDir) {
  const router = express.Router();

  router.get("/state", (_req, res) => {
    try {
      return res.json(buildState(rootDir));
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  router.post("/accounts", express.json(), (req, res) => {
    try {
      const account = upsertAccount(rootDir, req.body || {});
      return res.json({ ok: true, account, state: buildState(rootDir) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/test", express.json(), async (req, res) => {
    try {
      const result = await testConnection(rootDir, req.body || {});
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/snapshots", express.json(), (req, res) => {
    try {
      const snapshot = appendSnapshot(rootDir, req.body || {});
      return res.json({ ok: true, snapshot, state: buildState(rootDir) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  router.post("/accounts/:accountId/sync", express.json(), async (req, res) => {
    try {
      const result = await syncAccount(rootDir, req.params.accountId);
      return res.json({ ok: true, ...result, state: buildState(rootDir) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createAiUsageRoutes };