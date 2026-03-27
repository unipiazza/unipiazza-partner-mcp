import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { allHandlers, allTools } from "../tools/index.js";
import { executeTool } from "./dispatch.js";
import { createToolInputShape } from "./schema.js";
import { ToolExecutionContext } from "./context.js";

export type CreateMcpServerOptions = {
  getExecutionContext: () => ToolExecutionContext;
};

export function createServer(options: CreateMcpServerOptions) {
  const server = new McpServer(
    {
      name: "unipiazza-partner-mcp",
      version: "1.2.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  for (const tool of allTools) {
    const handler = allHandlers[tool.name];

    if (!handler) {
      continue;
    }

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: createToolInputShape(tool),
      },
      async (args) => {
        const context = options.getExecutionContext();
        const result = await executeTool(
          tool.name,
          (args ?? {}) as Record<string, unknown>,
          context,
        );

        return {
          content: [{ type: "text", text: result }],
        };
      },
    );
  }

  return server;
}
