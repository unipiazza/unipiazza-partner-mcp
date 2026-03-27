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
      "Get the list of products/rewards configured for the shop. Includes names, points required (coins), images, and status.",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        w_counter: {
          type: "boolean",
          description:
            "Include usage counters for the products (default false)",
        },
        counter_start_date: {
          type: "string",
          description: "Start date for usage counters (e.g. 2025-01-01)",
        },
        counter_end_date: {
          type: "string",
          description: "End date for usage counters (e.g. 2025-12-31)",
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
    const params = new URLSearchParams();
    if (args.w_counter !== undefined)
      params.append("w_counter", String(args.w_counter));
    if (args.counter_start_date)
      params.append("counter_start_date", String(args.counter_start_date));
    if (args.counter_end_date)
      params.append("counter_end_date", String(args.counter_end_date));

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await ctx.apiClient.get(
      `/products${query}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
