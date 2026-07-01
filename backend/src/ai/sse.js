"use strict";

/**
 * 极简 SSE（Server-Sent Events）工具。
 *
 * 仅依赖 Node 原生 res.write / res.end，零依赖。
 * 协议格式：data: {json}\n\n
 *   - 客户端用 EventSource 或 ReadableStream + TextDecoder 解析
 *   - 注释行以 ':' 开头，可用于心跳
 */

const HEARTBEAT_INTERVAL_MS = 15_000;

function setupSse(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
}

function send(res, event, data) {
  if (res.writableEnded) return;
  const payload = data === undefined ? "" : JSON.stringify(data);
  res.write(`event: ${event}\n`);
  res.write(`data: ${payload}\n\n`);
}

function comment(res, text) {
  if (res.writableEnded) return;
  res.write(`: ${text}\n\n`);
}

function endSse(res) {
  if (res.writableEnded) return;
  res.end();
}

function heartbeat(res) {
  const timer = setInterval(() => comment(res, "ping"), HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(timer);
}

module.exports = { setupSse, send, comment, endSse, heartbeat };
