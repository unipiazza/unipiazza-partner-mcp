import { randomUUID } from "node:crypto";
import { createExecutionContext } from "./core/context.js";
import {
  handleCallToolRequest as dispatchCallToolRequest,
  handleListToolsRequest,
} from "./core/dispatch.js";
import { createServer as createCoreServer } from "./core/server.js";
import { startStdioServer as startServer } from "./transports/stdio.js";

function createLegacyExecutionContext() {
  return createExecutionContext({
    authMode: "local-api-key",
    requestId: randomUUID(),
  });
}

export async function handleCallToolRequest(request: {
  params: { name: string; arguments?: Record<string, unknown> };
}, context = createLegacyExecutionContext()) {
  return dispatchCallToolRequest(request, context);
}

export function createServer() {
  return createCoreServer({
    getExecutionContext: createLegacyExecutionContext,
  });
}

export { handleListToolsRequest, startServer };
