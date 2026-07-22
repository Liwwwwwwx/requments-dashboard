import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TraceboardApiClient } from "./api-client.js";
import { loadConfig } from "./config.js";
import { createTraceboardMcpServer } from "./create-server.js";

const config = loadConfig();
const client = new TraceboardApiClient(config);
const server = createTraceboardMcpServer({ config, client });

const transport = new StdioServerTransport();
await server.connect(transport);

async function shutdown() {
  await server.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
