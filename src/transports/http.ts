import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createExecutionContext } from "../core/context.js";
import { createServer as createMcpServer } from "../core/server.js";
import { UnipiazzaOAuthProvider } from "../auth/oauth-provider.js";
import { getOAuthStore } from "../auth/store-factory.js";
import { ToolExecutionContext } from "../core/context.js";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL
  || `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;
const REMOTE_MCP_SCOPE = "mcp";
const RESOURCE_SERVER_URL = new URL("/mcp", PUBLIC_BASE_URL);
const TRUST_PROXY = process.env.TRUST_PROXY;
const DEFAULT_ALLOWED_HOSTS = [
  new URL(PUBLIC_BASE_URL).hostname,
  "localhost",
  "127.0.0.1",
  "[::1]",
];
const ALLOWED_HOSTS = (
  process.env.ALLOWED_HOSTS
    ? process.env.ALLOWED_HOSTS.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS
).filter((value, index, values) => values.indexOf(value) === index);

let oauthProviderPromise: Promise<UnipiazzaOAuthProvider> | undefined;

type SessionState = {
  server: ReturnType<typeof createMcpServer>;
  transport: StreamableHTTPServerTransport;
  setExecutionContext: (context: ToolExecutionContext) => void;
};

const httpSessions = new Map<string, SessionState>();

async function getOAuthProvider() {
  if (!oauthProviderPromise) {
    oauthProviderPromise = getOAuthStore().then(
      (store) => new UnipiazzaOAuthProvider(store, new URL(PUBLIC_BASE_URL)),
    );
  }

  return oauthProviderPromise;
}

function writeJsonError(
  res: { status: (statusCode: number) => { json: (body: unknown) => void } },
  statusCode: number,
  message: string,
) {
  res.status(statusCode).json({
    jsonrpc: "2.0",
    error: {
      code: statusCode === 400 ? -32700 : -32603,
      message,
    },
    id: null,
  });
}

function renderPendingCompletionPage(requestId: string) {
  const completionUrl = `/oauth/authorize/complete/${requestId}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Completing authorization</title>
  </head>
  <body>
    <p>Completing authorization…</p>
    <script>
      window.setTimeout(function () {
        window.location.replace(${JSON.stringify(completionUrl)});
      }, 1200);
    </script>
  </body>
</html>`;
}

async function requireRemoteBearerAuth(req: any, res: any, next: any) {
  try {
    const oauthProvider = await getOAuthProvider();
    return requireBearerAuth({
      verifier: oauthProvider,
      requiredScopes: [REMOTE_MCP_SCOPE],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
        RESOURCE_SERVER_URL,
      ),
    })(req, res, next);
  } catch (error) {
    return next(error);
  }
}

function buildExecutionContext(req: any, requestId: string): ToolExecutionContext {
  const authInfo = req.auth;
  const apiKeyFromAuthInfo =
    typeof authInfo?.extra?.apiKey === "string" ? authInfo.extra.apiKey : undefined;
  const authorizedShopIds = Array.isArray(authInfo?.extra?.authorizedShopIds)
    ? authInfo.extra.authorizedShopIds.filter(
        (shopId: unknown): shopId is string => typeof shopId === "string",
      )
    : undefined;
  const authMode =
    authInfo?.extra?.authMode === "legacy-api-key"
      ? "remote-api-key"
      : "remote-api-key";

  const logger = {
    info: (message: string, meta?: Record<string, unknown>) => {
      console.error(
        JSON.stringify({
          level: "info",
          transport: "http",
          requestId,
          message,
          ...(meta ?? {}),
        }),
      );
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      console.error(
        JSON.stringify({
          level: "error",
          transport: "http",
          requestId,
          message,
          ...(meta ?? {}),
        }),
      );
    },
  };

  return createExecutionContext({
    authMode,
    authToken: apiKeyFromAuthInfo,
    requestId,
    logger,
    authorizedShopIds,
  });
}

function createSessionState() {
  let currentExecutionContext: ToolExecutionContext;

  const server = createMcpServer({
    getExecutionContext: () => currentExecutionContext,
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      httpSessions.set(sessionId, sessionState);
    },
  });

  const sessionState: SessionState = {
    server,
    transport,
    setExecutionContext: (context) => {
      currentExecutionContext = context;
    },
  };

  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      httpSessions.delete(sessionId);
    }
    void server.close();
  };

  return sessionState;
}

async function getOrCreateSessionState(req: any, res: any) {
  const sessionId = req.headers["mcp-session-id"];

  if (typeof sessionId === "string" && httpSessions.has(sessionId)) {
    return httpSessions.get(sessionId)!;
  }

  if (!sessionId && isInitializeRequest(req.body)) {
    const sessionState = createSessionState();
    await sessionState.server.connect(sessionState.transport);
    return sessionState;
  }

  res.status(400).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Bad Request: No valid session ID provided",
    },
    id: null,
  });

  return undefined;
}

function getExistingSessionState(req: any, res: any) {
  const sessionId = req.headers["mcp-session-id"];
  if (typeof sessionId === "string" && httpSessions.has(sessionId)) {
    return httpSessions.get(sessionId)!;
  }

  res.status(400).send("Invalid or missing session ID");
  return undefined;
}

async function handleMcpPost(req: any, res: any) {
  const sessionState = await getOrCreateSessionState(req, res);
  if (!sessionState) {
    return;
  }

  const requestId = randomUUID();
  sessionState.setExecutionContext(buildExecutionContext(req, requestId));

  try {
    await sessionState.transport.handleRequest(req, res, req.body);
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: "error",
        transport: "http",
        requestId,
        message: "http_request_failed",
        error: error.message,
      }),
    );

    if (!res.headersSent) {
      writeJsonError(res, 500, "Internal server error");
    }
  }
}

async function handleMcpGet(req: any, res: any) {
  const sessionState = getExistingSessionState(req, res);
  if (!sessionState) {
    return;
  }

  const requestId = randomUUID();
  sessionState.setExecutionContext(buildExecutionContext(req, requestId));

  try {
    await sessionState.transport.handleRequest(req, res);
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: "error",
        transport: "http",
        requestId,
        message: "http_request_failed",
        error: error.message,
      }),
    );

    if (!res.headersSent) {
      writeJsonError(res, 500, "Internal server error");
    }
  }
}

async function handleMcpDelete(req: any, res: any) {
  const sessionState = getExistingSessionState(req, res);
  if (!sessionState) {
    return;
  }

  const requestId = randomUUID();
  sessionState.setExecutionContext(buildExecutionContext(req, requestId));

  try {
    await sessionState.transport.handleRequest(req, res);
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: "error",
        transport: "http",
        requestId,
        message: "http_request_failed",
        error: error.message,
      }),
    );

    if (!res.headersSent) {
      writeJsonError(res, 500, "Internal server error");
    }
  }
}

export function createRemoteHttpApp() {
  const app = createMcpExpressApp({
    host: HOST,
    allowedHosts: ALLOWED_HOSTS,
  });

  if (TRUST_PROXY) {
    const trustProxyValue =
      TRUST_PROXY === "true"
        ? true
        : TRUST_PROXY === "false"
          ? false
          : Number.isNaN(Number(TRUST_PROXY))
            ? TRUST_PROXY
            : Number(TRUST_PROXY);
    app.set("trust proxy", trustProxyValue);
  }

  app.get("/health", (_req: any, res: any) => {
    res.status(200).json({
      ok: true,
      transport: "http",
    });
  });

  app.get("/oauth/authorize/status/:requestId", async (req: any, res: any) => {
    try {
      const oauthProvider = await getOAuthProvider();
      const result = await oauthProvider.completePendingAuthorization(
        req.params.requestId,
      );
      res.status(result.status === "error" ? 400 : 200).json(result);
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  });

  app.get("/oauth/authorize/complete/:requestId", async (req: any, res: any) => {
    try {
      const oauthProvider = await getOAuthProvider();
      const result = await oauthProvider.completePendingAuthorization(
        req.params.requestId,
      );

      if (result.status === "complete") {
        res.redirect(result.redirectUrl);
        return;
      }

      if (result.status === "pending") {
        res
          .status(200)
          .setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderPendingCompletionPage(req.params.requestId));
        return;
      }

      res.status(400).send(result.message);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  });

  app.use(async (req: any, res: any, next: any) => {
    try {
      const oauthProvider = await getOAuthProvider();
      return mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl: new URL(PUBLIC_BASE_URL),
        baseUrl: new URL(PUBLIC_BASE_URL),
        resourceServerUrl: RESOURCE_SERVER_URL,
        resourceName: "Unipiazza MCP",
        scopesSupported: [REMOTE_MCP_SCOPE],
        serviceDocumentationUrl: new URL(PUBLIC_BASE_URL),
      })(req, res, next);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/mcp", requireRemoteBearerAuth, handleMcpGet);
  app.post("/mcp", requireRemoteBearerAuth, handleMcpPost);
  app.delete("/mcp", requireRemoteBearerAuth, handleMcpDelete);

  app.all("/mcp", (_req: any, res: any) => {
    writeJsonError(res, 405, "Method not allowed.");
  });

  app.use((_req: any, res: any) => {
    res.status(404).json({
      error: "Not found",
    });
  });

  return app;
}

export function createRemoteHttpServer() {
  return createServer(createRemoteHttpApp());
}

export async function startRemoteHttpServer() {
  const server = createRemoteHttpServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, () => resolve());
  });

  console.error(
    `Unipiazza Partner MCP Server listening over HTTP on ${PUBLIC_BASE_URL}`,
  );
}
