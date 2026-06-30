"use strict";

/**
 * 统一的 API 错误响应：
 *   { ok: false, code: string, message: string, details?: object }
 *
 * 路由里用 `ApiError` 构造，通过 `httpError(status, code, message, details)` 抛出，
 * 由 `errorMiddleware` 转成 JSON 响应。
 */

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function httpError(status, code, message, details) {
  return new ApiError(status, code, message, details);
}

function isApiError(err) {
  return Boolean(
    err &&
      typeof err === "object" &&
      err.name === "ApiError" &&
      typeof err.code === "string" &&
      typeof err.status === "number"
  );
}

function errorMiddleware() {
  return function (err, _req, res, _next) {
    if (isApiError(err)) {
      const body = { ok: false, code: err.code, message: err.message };
      if (err.details !== undefined) body.details = err.details;
      return res.status(err.status).json(body);
    }
    const message = err && err.message ? err.message : "Internal Server Error";
    return res.status(400).json({ ok: false, code: "BAD_REQUEST", message });
  };
}

module.exports = { ApiError, httpError, errorMiddleware };