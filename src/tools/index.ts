import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolExecutionContext } from "../core/context.js";

import { systemTools, systemHandlers } from "./system.js";
import { shopTools, shopHandlers } from "./shop.js";
import { usersTools, usersHandlers } from "./users.js";
import { statsTools, statsHandlers } from "./stats.js";
import { campaignsTools, campaignsHandlers } from "./campaigns.js";
import { boostersTools, boostersHandlers } from "./boosters.js";
import { loyaltyTools, loyaltyHandlers } from "./loyalty.js";

// All tool definitions exposed to the MCP client
export const allTools: Tool[] = [
  ...systemTools,
  ...shopTools,
  ...usersTools,
  ...statsTools,
  ...campaignsTools,
  ...boostersTools,
  ...loyaltyTools,
];

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => Promise<string>;

// Merged handler map: tool name → async handler function
export const allHandlers: Record<string, ToolHandler> = {
  ...systemHandlers,
  ...shopHandlers,
  ...usersHandlers,
  ...statsHandlers,
  ...campaignsHandlers,
  ...boostersHandlers,
  ...loyaltyHandlers,
};
