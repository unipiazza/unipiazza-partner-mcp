import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the system domain
export const systemTools: Tool[] = [
  {
    name: "list_shops",
    description:
      "List all shops accessible with the current API key. Call this first to discover available shop IDs, then pass a shop_id to other tools.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_server_status",
    description: "Check if the Unipiazza API is reachable and the MCP can connect to it",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
];

// Handlers map for system tools
export const systemHandlers: Record<string, ToolHandler> = {
  list_shops: async (_args, ctx) => {
    const data = await ctx.apiClient.get("/shops");
    return JSON.stringify(data, null, 2);
  },
  get_server_status: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/ping",
      undefined,
      args.shop_id as string | undefined,
    );
    return `Backend connected successfully! Response: ${JSON.stringify(data, null, 2)}`;
  },
};
