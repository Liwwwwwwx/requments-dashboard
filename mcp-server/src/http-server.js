import crypto from "node:crypto";
import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createTraceboardMcpServer } from "./create-server.js";

function jsonRpcError(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

function validBearerToken(header, expected) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const received = Buffer.from(header.slice(7));
  const token = Buffer.from(expected);
  return received.length === token.length && crypto.timingSafeEqual(received, token);
}

export function createHttpMcpServer({ config, client }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname !== "/mcp") return jsonRpcError(res, 404, "MCP endpoint not found");
    if (!validBearerToken(req.headers.authorization, config.accessToken)) return jsonRpcError(res, 401, "Unauthorized");
    if (req.headers.host !== config.publicHost) return jsonRpcError(res, 403, "Invalid host");
    if (req.headers.origin && req.headers.origin !== config.publicOrigin) return jsonRpcError(res, 403, "Invalid origin");
    if (req.method !== "POST") return jsonRpcError(res, 405, "Method not allowed");

    const server = createTraceboardMcpServer({ config, client });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts: [config.publicHost],
      allowedOrigins: [config.publicOrigin]
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
      res.once("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
    } catch (error) {
      console.error("MCP HTTP request failed", error instanceof Error ? error.message : error);
      if (!res.headersSent) jsonRpcError(res, 500, "Internal server error");
    }
  });
}
