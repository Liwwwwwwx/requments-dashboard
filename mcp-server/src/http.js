import { TraceboardApiClient } from "./api-client.js";
import { loadHttpConfig } from "./config.js";
import { createHttpMcpServer } from "./http-server.js";

const config = loadHttpConfig();
const server = createHttpMcpServer({ config, client: new TraceboardApiClient(config) });

server.listen(config.port, config.host, () => {
  console.error(`TraceBoard MCP HTTP listening on ${config.host}:${config.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
