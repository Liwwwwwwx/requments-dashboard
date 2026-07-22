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
