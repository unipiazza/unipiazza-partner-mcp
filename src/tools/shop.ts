import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the shop domain
export const shopTools: Tool[] = [
  {
    name: "get_shop_details",
    description:
      "Get the complete details and configuration of the authenticated Partner's shop (name, location, app settings) including all active Unipiazza features such as subscription plan, booster, wallet, gift cards, and any other enabled modules.",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
  {
    name: "get_shop_products",
    description:
      "Get the list of products/rewards configured for the shop. Includes names, points required (coins), images, and status. For reward redemption statistics, use get_prize_stats instead.",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
  {
    name: "get_prize_stats",
    description:
      "Get aggregate reward redemption statistics for a shop, counted by prize/product within an optional date range. Use this for questions like how many pizzas, coffees, or rewards were redeemed.",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        start_date: {
          type: "string",
          description: "Start date for redemption counters (e.g. 2026-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date for redemption counters (e.g. 2026-06-04)",
        },
      },
      required: ["shop_id"],
    },
  },
];

// Handlers map for shop tools
export const shopHandlers: Record<
  string,
  ToolHandler
> = {
  get_shop_details: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/shop-details",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_shop_products: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/products",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_prize_stats: async (args, ctx) => {
    const params = new URLSearchParams();
    if (args.start_date) params.append("start_date", String(args.start_date));
    if (args.end_date) params.append("end_date", String(args.end_date));

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await ctx.apiClient.get(
      `/prize_stats${query}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
