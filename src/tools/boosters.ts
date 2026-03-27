import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the boosters domain
// Boosters are reward multiplier/addition rules applied on specific days or time slots
export const boostersTools: Tool[] = [
  {
    name: "get_boosters",
    description:
      "Get the reward booster rules for the shop. Boosters are multiplier or flat-addition rules that give customers extra coins during specific days or time slots (e.g. double coins on Mondays, +5 coins on Friday evenings).",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
];

// Handlers map for boosters tools
export const boostersHandlers: Record<string, ToolHandler> = {
  get_boosters: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/boosters",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
