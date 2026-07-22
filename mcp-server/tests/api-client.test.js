import { describe, expect, it, vi } from "vitest";
import { TraceboardApiClient, TraceboardApiError } from "../src/api-client.js";

function response(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("TraceboardApiClient", () => {
  it("encodes paths and sends a bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, { ok: true }));
    const client = new TraceboardApiClient({ baseUrl: "https://board.example", token: "secret", fetchImpl });
    await client.getRequirement("project one", "REQ/1");

    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://board.example/api/projects/project%20one/requirements/REQ%2F1");
    expect(options.headers.Authorization).toBe("Bearer secret");
  });

  it("does not leak a token in API errors", async () => {
    const client = new TraceboardApiClient({
      baseUrl: "https://board.example",
      token: "secret-token",
      fetchImpl: vi.fn().mockResolvedValue(response(401, { code: "UNAUTHORIZED", message: "未授权" }))
    });

    await expect(client.listProjects()).rejects.toMatchObject({ name: TraceboardApiError.name, code: "UNAUTHORIZED", message: "未授权" });
  });

  it("adds notes through the requirement event API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(201, { ok: true }));
    const client = new TraceboardApiClient({ baseUrl: "http://localhost:4315", token: "secret", fetchImpl });
    await client.addRequirementNote("alpha", "REQ-0001", "已完成联调");

    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("http://localhost:4315/api/projects/alpha/requirements/REQ-0001/events");
    expect(JSON.parse(options.body)).toEqual({ kind: "note.add", text: "已完成联调" });
  });

  it("uses DELETE endpoints for projects and requirements", async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(response(200, { ok: true, deleted: true })));
    const client = new TraceboardApiClient({ baseUrl: "http://localhost:4315", token: "secret", fetchImpl });
    await client.deleteProject("alpha");
    await client.deleteRequirement("alpha", "REQ-0001");

    expect(fetchImpl.mock.calls.map(([url, options]) => [String(url), options.method])).toEqual([
      ["http://localhost:4315/api/projects/alpha", "DELETE"],
      ["http://localhost:4315/api/projects/alpha/requirements/REQ-0001", "DELETE"]
    ]);
  });
});
