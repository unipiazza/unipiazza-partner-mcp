import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandler } from "./index.js";

const shopIdParam = {
  shop_id: {
    type: "string",
    description: "The ID of the shop to query. Use list_shops to get the available shop IDs.",
  },
};

// Tool definitions for the users domain
export const usersTools: Tool[] = [
  {
    name: "list_users",
    description:
      "Get a paginated list of all customers registered in the shop, with optional sorting and filtering",
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
        sorting_by: {
          type: "string",
          description:
            "Field to sort by. Default: 'name'. Options: 'name' (alphabetical), 'coins' (loyalty points balance), 'euros_spent' (total spending), 'receipts_counter' (number of transactions), 'prizes_counter' (prizes won), 'last_checkin_at' (most recent visit), 'signed_from' (registration date)",
          enum: [
            "name",
            "coins",
            "euros_spent",
            "receipts_counter",
            "prizes_counter",
            "last_checkin_at",
            "signed_from",
          ],
        },
        sorting_descending: {
          type: "boolean",
          description: "Sort descending (default true)",
        },
        filter_by: {
          type: "string",
          description:
            "Filter subset. Default: 'all'. Options: 'all' (every customer), 'new' (registered in the last 30 days), 'following' (customers who follow the shop), 'vip' (VIP customers), 'inactive' (no visits in the last 90 days), 'users_list' (customers from a saved campaign list), 'imported' (imported customers)",
          enum: [
            "all",
            "new",
            "following",
            "vip",
            "inactive",
            "users_list",
            "imported",
          ],
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "search_users",
    description:
      "Search for users/customers registered in the Partner's shop by name, email, or phone.",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        query: {
          type: "string",
          description: "The search query (name, email or phone part)",
        },
        sorting_by: {
          type: "string",
          description:
            "Field to sort by. Default: 'name'. Options: 'name' (alphabetical), 'coins' (loyalty points balance), 'euros_spent' (total spending), 'receipts_counter' (number of transactions), 'prizes_counter' (prizes won), 'last_checkin_at' (most recent visit), 'signed_from' (registration date)",
          enum: [
            "name",
            "coins",
            "euros_spent",
            "receipts_counter",
            "prizes_counter",
            "last_checkin_at",
            "signed_from",
          ],
        },
        sorting_descending: {
          type: "boolean",
          description: "Sort descending (default true)",
        },
      },
      required: ["shop_id", "query"],
    },
  },
  {
    name: "get_user_details",
    description:
      "Get the full profile of a specific customer by their user ID (coins balance, tier, registration date, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        user_id: {
          type: "string",
          description: "The MongoDB ObjectID of the user",
        },
      },
      required: ["shop_id", "user_id"],
    },
  },
  {
    name: "get_history",
    description:
      "Get the shop-level customer activity history across all users: visits, rewards, redemptions, wallet movements, signups, and marketing events",
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
          description: "Number of results per page (default 20)",
        },
        action: {
          type: "string",
          description:
            "Optional event/action filter supported by the backend history feed",
        },
        start_date: {
          type: "string",
          description: "Optional start date filter in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "Optional end date filter in YYYY-MM-DD format",
        },
        items_count: {
          type: "number",
          description:
            "Optional total items count hint forwarded to the backend history feed",
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "get_user_history",
    description:
      "Get the visit and transaction history of a specific customer (check-ins, rewards earned, redemptions)",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        user_id: {
          type: "string",
          description: "The MongoDB ObjectID of the user",
        },
        page: {
          type: "number",
          description: "Page number (0-indexed, default 0)",
        },
        per_page: {
          type: "number",
          description: "Number of results per page (default 20)",
        },
      },
      required: ["shop_id", "user_id"],
    },
  },
  {
    name: "get_users_birthdays",
    description:
      "Get the list of customers with a birthday, grouped by day within the month. Prefer passing 'month' (1–12) to keep the response small and focused — e.g. use the current month for proactive birthday campaigns. Omitting 'month' returns all 12 months at once and may produce a very large response: only do so when the shop has a small customer base or you need a full-year overview.",
    inputSchema: {
      type: "object",
      properties: {
        ...shopIdParam,
        month: {
          type: "number",
          description:
            "Filter by month (1=January … 12=December). If omitted, all months are returned.",
        },
      },
      required: ["shop_id"],
    },
  },
  {
    name: "get_users_stats",
    description:
      "Get aggregate statistics about the shop's customer base (total registered, active, new this month, etc.)",
    inputSchema: {
      type: "object",
      properties: { ...shopIdParam },
      required: ["shop_id"],
    },
  },
];

// Handlers map for users tools
export const usersHandlers: Record<
  string,
  ToolHandler
> = {
  list_users: async (args, ctx) => {
    const params = new URLSearchParams();
    if (args.page !== undefined) params.append("page", String(args.page));
    if (args.per_page !== undefined)
      params.append("per_page", String(args.per_page));
    if (args.sorting_by) params.append("sorting_by", String(args.sorting_by));
    if (args.sorting_descending !== undefined)
      params.append("sorting_descending", String(args.sorting_descending));
    if (args.filter_by) params.append("filter_by", String(args.filter_by));

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await ctx.apiClient.get(
      `/users${query}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  search_users: async (args, ctx) => {
    const q = args.query as string;
    if (!q) throw new Error("Missing required argument 'query'");
    const params = new URLSearchParams({ q });
    if (args.sorting_by) params.append("sorting_by", String(args.sorting_by));
    if (args.sorting_descending !== undefined)
      params.append("sorting_descending", String(args.sorting_descending));
    const data = await ctx.apiClient.get(
      `/users/search?${params.toString()}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_user_details: async (args, ctx) => {
    const userId = args.user_id as string;
    if (!userId) throw new Error("Missing required argument 'user_id'");
    const data = await ctx.apiClient.get(
      `/users/${encodeURIComponent(userId)}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_history: async (args, ctx) => {
    const params = new URLSearchParams();
    params.append("page", String((args.page as number) ?? 0));
    params.append("per_page", String((args.per_page as number) ?? 20));
    if (args.action) params.append("action", String(args.action));
    if (args.start_date) params.append("start_date", String(args.start_date));
    if (args.end_date) params.append("end_date", String(args.end_date));
    if (args.items_count !== undefined)
      params.append("items_count", String(args.items_count));

    const data = await ctx.apiClient.get(
      `/users/history?${params.toString()}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_user_history: async (args, ctx) => {
    const userId = args.user_id as string;
    if (!userId) throw new Error("Missing required argument 'user_id'");
    const page = (args.page as number) ?? 0;
    const perPage = (args.per_page as number) ?? 20;
    const data = await ctx.apiClient.get(
      `/users/${encodeURIComponent(userId)}/history?page=${page}&per_page=${perPage}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_users_birthdays: async (args, ctx) => {
    const params = new URLSearchParams();
    if (args.month !== undefined) params.append("month", String(args.month));
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await ctx.apiClient.get(
      `/users/birthdays${query}`,
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },

  get_users_stats: async (args, ctx) => {
    const data = await ctx.apiClient.get(
      "/users/users_stats",
      undefined,
      args.shop_id as string | undefined,
    );
    return JSON.stringify(data, null, 2);
  },
};
