import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { allHandlers, allTools, ToolHandler } from "../tools/index.js";
import { ToolExecutionContext } from "./context.js";

type CallToolRequest = {
  params: { name: string; arguments?: Record<string, unknown> };
};

type DispatchDependencies = {
  tools?: Tool[];
  handlers?: Record<string, ToolHandler>;
};

function getRequiredProperties(tool: Tool): string[] {
  const required = (tool.inputSchema as { required?: unknown } | undefined)
    ?.required;

  return Array.isArray(required)
    ? required.filter((value): value is string => typeof value === "string")
    : [];
}

function getTool(name: string, tools: Tool[]): Tool | undefined {
  return tools.find((tool) => tool.name === name);
}

function validateArguments(tool: Tool, args: Record<string, unknown>): string | null {
  const requiredProperties = getRequiredProperties(tool);

  for (const property of requiredProperties) {
    const value = args[property];
    if (value === undefined || value === null || value === "") {
      return `Missing required argument '${property}'`;
    }
  }

  return null;
}

function validateAuthorizedShopId(
  context: ToolExecutionContext,
  args: Record<string, unknown>,
): string | null {
  const shopId = args.shop_id;
  if (typeof shopId !== "string" || context.authorizedShopIds === undefined) {
    return null;
  }

  if (
    context.authorizedShopIds.length > 0 &&
    !context.authorizedShopIds.includes(shopId)
  ) {
    return `Unauthorized shop_id '${shopId}'`;
  }

  return null;
}

export async function handleListToolsRequest(
  dependencies?: DispatchDependencies,
) {
  return { tools: dependencies?.tools ?? allTools };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
  dependencies?: DispatchDependencies,
) {
  const handlers = dependencies?.handlers ?? allHandlers;
  const handler = handlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  context.logger.info("tool_call_started", {
    requestId: context.requestId,
    authMode: context.authMode,
    tool: name,
    shopId: typeof args.shop_id === "string" ? args.shop_id : undefined,
  });

  try {
    const result = await handler(args, context);

    context.logger.info("tool_call_completed", {
      requestId: context.requestId,
      authMode: context.authMode,
      tool: name,
    });

    return result;
  } catch (error: any) {
    context.logger.error("tool_call_failed", {
      requestId: context.requestId,
      authMode: context.authMode,
      tool: name,
      error: error.message,
    });
    throw error;
  }
}

export async function handleCallToolRequest(
  request: CallToolRequest,
  context: ToolExecutionContext,
  dependencies?: DispatchDependencies,
) {
  const tools = dependencies?.tools ?? allTools;
  const { name, arguments: args } = request.params;
  const normalizedArgs = (args ?? {}) as Record<string, unknown>;

  const tool = getTool(name, tools);
  const handler = (dependencies?.handlers ?? allHandlers)[name];

  if (!tool || !handler) {
    return {
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  const validationError = validateArguments(tool, normalizedArgs);
  if (validationError) {
    return {
      content: [{ type: "text" as const, text: validationError }],
      isError: true,
    };
  }

  const authorizationError = validateAuthorizedShopId(context, normalizedArgs);
  if (authorizationError) {
    return {
      content: [{ type: "text" as const, text: authorizationError }],
      isError: true,
    };
  }

  try {
    const result = await executeTool(name, normalizedArgs, context, dependencies);

    return {
      content: [{ type: "text" as const, text: result }],
    };
  } catch (error: any) {
    return {
      content: [
        { type: "text" as const, text: `Error executing ${name}: ${error.message}` },
      ],
      isError: true,
    };
  }
}
