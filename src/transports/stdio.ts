import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createExecutionContext } from "../core/context.js";
import { createServer } from "../core/server.js";

export async function startStdioServer() {
  const transport = new StdioServerTransport();
  const server = createServer({
    getExecutionContext: () =>
      createExecutionContext({
        authMode: "local-api-key",
        requestId: randomUUID(),
      }),
  });

  await server.connect(transport);
  console.error("Unipiazza Partner MCP Server started over stdio");
}
