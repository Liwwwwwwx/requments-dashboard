"use strict";

const fs = require("fs");
const { projectPaths } = require("../projects");
const { readEvents } = require("../events");
const { render } = require("../state");

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function createDashboardRoutes(rootDir) {
  const router = require("express").Router();

  router.get("/dashboard/summary", (req, res, next) => {
    const project = req.query.project;
    if (!project) {
      return res.status(400).json({ ok: false, error: "MISSING_PROJECT" });
    }

    const paths = projectPaths(rootDir, project);
    if (!fs.existsSync(paths.eventsPath) && !fs.existsSync(paths.stateJsonPath)) {
      return next(httpError(404, "PROJECT_NOT_FOUND", `项目不存在：${project}`));
    }
    if (!fs.existsSync(paths.stateJsonPath)) {
      render(paths);
    }

    const state = JSON.parse(fs.readFileSync(paths.stateJsonPath, "utf8"));
    const items = state.items || [];

    const byStatus = { todo: 0, doing: 0, paused: 0, done: 0 };
    const byPriority = { P0: 0, P1: 0, P2: 0 };
    let blockedCount = 0;
    const blockedItems = [];

    for (const item of items) {
      if (byStatus[item.status] !== undefined) byStatus[item.status]++;
      if (byPriority[item.priority] !== undefined) byPriority[item.priority]++;
      const blocked = item.taskStats?.blocked || 0;
      blockedCount += blocked;
      if (blocked > 0) {
        blockedItems.push({ id: item.id, title: item.title, blocked });
      }
    }

    const completionRate = items.length > 0
      ? Math.round((byStatus.done / items.length) * 100)
      : 0;

    const now = new Date();
    const weeklyTrend = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      weeklyTrend.push({
        week: isoWeek(d),
        label: `W${isoWeek(d).split("-W")[1]}`
      });
    }

    const events = readEvents(paths.eventsPath);
    const recentEvents = events
      .slice(-8)
      .reverse()
      .map((e) => ({
        eventId: e.eventId,
        ts: e.ts,
        kind: e.kind,
        actor: e.actor,
        requirementId: e.requirementId,
        summary: e.summary || e.title || e.kind
      }));

    const eventsByWeek = {};
    for (const evt of events) {
      const d = new Date(evt.ts || 0);
      const wk = isoWeek(d);
      eventsByWeek[wk] = (eventsByWeek[wk] || 0) + 1;
    }
    for (const entry of weeklyTrend) {
      entry.count = eventsByWeek[entry.week] || 0;
    }

    const health = {
      total: items.length,
      activeRate: items.length > 0 ? Math.round(((byStatus.doing + byStatus.todo) / items.length) * 100) : 0,
      blockedRate: items.length > 0 ? Math.round((blockedItems.length / items.length) * 100) : 0,
      completionRate
    };

    res.json({
      ok: true,
      project,
      byStatus,
      byPriority,
      completionRate,
      blockedCount,
      blockedItems: blockedItems.slice(0, 5),
      weeklyTrend,
      recentEvents,
      health
    });
  });

  return router;
}

module.exports = { createDashboardRoutes };
