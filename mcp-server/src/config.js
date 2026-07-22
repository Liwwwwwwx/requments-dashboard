function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadConfig(env = process.env) {
  const baseUrl = required(env, "TRACEBOARD_BASE_URL").replace(/\/$/, "");
  try {
    new URL(baseUrl);
  } catch {
    throw new Error("TRACEBOARD_BASE_URL must be an absolute URL");
  }

  const timeoutMs = Number(env.TRACEBOARD_TIMEOUT_MS || 15000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("TRACEBOARD_TIMEOUT_MS must be a positive number");
  }

  return {
    baseUrl,
    token: required(env, "TRACEBOARD_API_TOKEN"),
    defaultProject: String(env.TRACEBOARD_DEFAULT_PROJECT || "").trim() || undefined,
    timeoutMs
  };
}

export function loadHttpConfig(env = process.env) {
  const config = loadConfig(env);
  const publicOrigin = required(env, "MCP_PUBLIC_ORIGIN").replace(/\/$/, "");
  let origin;
  try {
    origin = new URL(publicOrigin);
  } catch {
    throw new Error("MCP_PUBLIC_ORIGIN must be an absolute URL");
  }
  if (origin.protocol !== "https:") throw new Error("MCP_PUBLIC_ORIGIN must use HTTPS");

  const port = Number(env.MCP_PORT || 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MCP_PORT must be a valid TCP port");
  }

  return {
    ...config,
    accessToken: required(env, "MCP_ACCESS_TOKEN"),
    host: String(env.MCP_HOST || "127.0.0.1").trim(),
    port,
    publicOrigin,
    publicHost: origin.host
  };
}
