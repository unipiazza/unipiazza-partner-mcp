import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the stats domain
export const statsTools: Tool[] = [
  {
    name: "get_stats",
    description:
      "Get the global KPIs for the shop: total visits, coins issued, active users, trends over time",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
  {
    name: "get_stats_partial",
    description:
      "Get shop KPIs filtered by a date range: visits, coins issued, active users within a specific period",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        start_date: {
          type: "string",
          description: "Start date for the period (ISO 8601, e.g. 2024-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date for the period (ISO 8601, e.g. 2024-12-31)",
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "get_stats_users",
    description:
      "Get detailed user base analytics: new vs returning customers, growth trend, churn indicators",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
  {
    name: "get_stats_timetable",
    description:
      "Get the hourly visit distribution for the shop — useful to understand peak hours and slow periods",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
];

// Handlers map for stats tools
export const statsHandlers: Record<string, ToolHandler> = {
  get_stats: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/stats",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_stats_partial: async (args, ctx) => {
    const params: Record<string, string> = {};
    if (args.start_date) params.start_date = args.start_date as string;
    if (args.end_date) params.end_date = args.end_date as string;
    const data = await ctx.apiClient.get(
      "/stats/partial",
      Object.keys(params).length ? params : undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_stats_users: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/stats/users",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_stats_timetable: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/stats/timetable",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
