import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the loyalty domain (wallets and subscriptions)
export const loyaltyTools: Tool[] = [
  {
    name: "get_wallets",
    description:
      "Get the list of loyalty wallets and gift cards issued by the shop (pass types, active passes count, gift card balances)",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
  {
    name: "get_subscription_products",
    description:
      "Get the list of subscription products available in the shop (e.g. monthly loyalty packs, prepaid bundles) including metrics about active subscribers",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
];

// Handlers map for loyalty tools
export const loyaltyHandlers: Record<string, ToolHandler> = {
  get_wallets: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/wallets",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_subscription_products: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/subscription_products",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
