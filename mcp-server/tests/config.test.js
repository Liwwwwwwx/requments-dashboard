import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

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
