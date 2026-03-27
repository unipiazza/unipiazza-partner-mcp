import { createMcpApiClient, McpApiClient } from "../api-client.js";

export type AuthMode = "local-api-key" | "remote-api-key";

export type ToolLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export type RemotePrincipal = {
  type: "mcp-api-key";
  tokenPreview: string;
};

export type ToolExecutionContext = {
  authMode: AuthMode;
  authToken?: string;
  principal?: RemotePrincipal;
  authorizedShopIds?: string[];
  requestId: string;
  logger: ToolLogger;
  apiClient: McpApiClient;
};

export type CreateExecutionContextOptions = {
  authMode: AuthMode;
  authToken?: string;
  requestId: string;
  logger?: ToolLogger;
  principal?: RemotePrincipal;
  authorizedShopIds?: string[];
};

const defaultLogger: ToolLogger = {
  info: (message, meta) => {
    console.error(
      JSON.stringify({
        level: "info",
        message,
        ...(meta ?? {}),
      }),
    );
  },
  error: (message, meta) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        ...(meta ?? {}),
      }),
    );
  },
};

function createPrincipal(authToken?: string): RemotePrincipal | undefined {
  if (!authToken) return undefined;

  return {
    type: "mcp-api-key",
    tokenPreview: `${authToken.slice(0, 6)}...${authToken.slice(-4)}`,
  };
}

export function createExecutionContext(
  options: CreateExecutionContextOptions,
): ToolExecutionContext {
  return {
    authMode: options.authMode,
    authToken: options.authToken,
    principal: options.principal ?? createPrincipal(options.authToken),
    requestId: options.requestId,
    logger: options.logger ?? defaultLogger,
    authorizedShopIds: options.authorizedShopIds,
    apiClient: createMcpApiClient(options.authToken),
  };
}
