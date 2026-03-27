import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the campaigns domain
export const campaignsTools: Tool[] = [
  {
    name: "list_marketing_campaigns",
    description:
      "Get a paginated list of marketing campaigns sent by the shop (email, RCS, push notifications), including campaign content, scheduling details, delivery metrics, and engagement metrics for each campaign.",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        page: {
          type: "number",
          description: "Page number (0-indexed, default 0)",
        },
        per_page: {
          type: "number",
          description: "Results per page (default 20)",
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "get_autopromos",
    description:
      "Get the list of automatic promotions configured for the shop, including business-friendly labels, trigger descriptions, activation status, reward configuration, and channel-specific settings.",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
  {
    name: "get_autopromo_metrics",
    description:
      "Get performance metrics for all automatic promotions, grouped by promotion type with human-readable labels and per-promotion KPIs such as sends, deliveries, generated users, generated visits, clicks, and generated euros — optionally filtered by date range",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        start_date: {
          type: "string",
          description: "Start date in ISO 8601 format (e.g. 2025-01-01). Defaults to all-time.",
        },
        end_date: {
          type: "string",
          description: "End date in ISO 8601 format (e.g. 2025-12-31). Defaults to today.",
        },
      },
      required: ["shop_id"],
    },
  },
];

// Handlers map for campaigns tools
export const campaignsHandlers: Record<string, ToolHandler> = {
  list_marketing_campaigns: async (args, ctx) => {
    const params = new URLSearchParams();
    if (args.page !== undefined) params.append("page", String(args.page));
    if (args.per_page !== undefined) params.append("per_page", String(args.per_page));
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await ctx.apiClient.get(
      `/campaigns${query}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_autopromos: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/autopromos",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_autopromo_metrics: async (args, ctx) => {
    const params = new URLSearchParams();
    if (args.start_date) params.append("start_date", args.start_date as string);
    if (args.end_date) params.append("end_date", args.end_date as string);
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await ctx.apiClient.get(
      `/autopromos/metrics${query}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
