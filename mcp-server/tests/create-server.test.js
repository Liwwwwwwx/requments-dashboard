import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTraceboardMcpServer } from "../src/create-server.js";

describe("TraceBoard MCP server", () => {
  it("publishes the expected tools and calls the requirement API", async () => {
    const apiClient = {
      listProjects: async () => ({ ok: true, projects: [{ id: "alpha", name: "Alpha" }] }),
      listRequirements: async () => ({
        ok: true,
        project: "alpha",
        requirements: [
          { id: "REQ-0001", title: "登录", summary: "登录能力", status: "todo", priority: "P1" },
          { id: "REQ-0002", title: "导出", summary: "导出能力", status: "done", priority: "P2" }
        ]
      })
    };
    const server = createTraceboardMcpServer({ config: {}, client: apiClient });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "traceboard-test-client", version: "1.0.0" });

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
        "list_projects",
        "create_project",
        "update_project",
        "delete_project",
        "list_requirements",
        "create_requirement",
        "change_requirement_status",
        "delete_requirement",
        "add_requirement_note"
      ]));

      const result = await client.callTool({
        name: "list_requirements",
        arguments: { project: "alpha", status: "todo" }
      });
      expect(result.isError).not.toBe(true);
      expect(result.content[0].text).toContain("REQ-0001");
      expect(result.content[0].text).not.toContain("REQ-0002");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
