import { describe, expect, it } from "vitest";
import { loadConfig, loadHttpConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("requires the API URL and token", () => {
    expect(() => loadConfig({})).toThrow("TRACEBOARD_BASE_URL is required");
    expect(() => loadConfig({ TRACEBOARD_BASE_URL: "http://localhost:4315" })).toThrow("TRACEBOARD_API_TOKEN is required");
  });

  it("normalizes valid configuration", () => {
    expect(loadConfig({
      TRACEBOARD_BASE_URL: "http://localhost:4315/",
      TRACEBOARD_API_TOKEN: "test-token",
      TRACEBOARD_DEFAULT_PROJECT: "alpha"
    })).toMatchObject({ baseUrl: "http://localhost:4315", defaultProject: "alpha", timeoutMs: 15000 });
  });
});

describe("loadHttpConfig", () => {
  const env = {
    TRACEBOARD_BASE_URL: "http://127.0.0.1:4315",
    TRACEBOARD_API_TOKEN: "upstream-token",
    MCP_ACCESS_TOKEN: "public-token",
    MCP_PUBLIC_ORIGIN: "https://aiwai.cloud"
  };

  it("requires a HTTPS public origin", () => {
    expect(() => loadHttpConfig({ ...env, MCP_PUBLIC_ORIGIN: "http://aiwai.cloud" }))
      .toThrow("MCP_PUBLIC_ORIGIN must use HTTPS");
  });

  it("builds the private listener and public host settings", () => {
    expect(loadHttpConfig(env)).toMatchObject({
      host: "127.0.0.1",
      port: 4318,
      publicOrigin: "https://aiwai.cloud",
      publicHost: "aiwai.cloud",
      accessToken: "public-token"
    });
  });
});
