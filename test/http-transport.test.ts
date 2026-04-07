import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: any, res: any, next?: any) => unknown;

const {
  handleRequestMock,
  closeTransportMock,
  connectServerMock,
  closeServerMock,
  requireBearerAuthMock,
  createExecutionContextMock,
  isInitializeRequestMock,
} = vi.hoisted(() => ({
  handleRequestMock: vi.fn(),
  closeTransportMock: vi.fn(),
  connectServerMock: vi.fn(),
  closeServerMock: vi.fn(),
  requireBearerAuthMock: vi.fn(),
  createExecutionContextMock: vi.fn(() => ({})),
  isInitializeRequestMock: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class MockStreamableHTTPServerTransport {
    sessionId: string | undefined;
    onclose?: () => void;
    private readonly options: any;

    constructor(options: any = {}) {
      this.options = options;
    }

    handleRequest = async (req: any, res: any, body?: any) => {
      if (!this.sessionId && req.method === "POST" && !req.headers["mcp-session-id"]) {
        this.sessionId = "session-1";
        if (this.sessionId) {
          this.options.onsessioninitialized?.(this.sessionId);
        }
      }
      return handleRequestMock(req, res, body);
    };
    close = closeTransportMock;
  },
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  isInitializeRequest: isInitializeRequestMock,
}));

vi.mock("@modelcontextprotocol/sdk/server/express.js", () => ({
  createMcpExpressApp() {
    const routes = {
      get: new Map<string, Handler[]>(),
      post: new Map<string, Handler[]>(),
      delete: new Map<string, Handler[]>(),
      all: new Map<string, Handler[]>(),
    };

    return {
      __routes: routes,
      set: vi.fn(),
      use: vi.fn(),
      get(path: string, ...handlers: Handler[]) {
        routes.get.set(path, handlers);
      },
      post(path: string, ...handlers: Handler[]) {
        routes.post.set(path, handlers);
      },
      delete(path: string, ...handlers: Handler[]) {
        routes.delete.set(path, handlers);
      },
      all(path: string, ...handlers: Handler[]) {
        routes.all.set(path, handlers);
      },
    };
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/auth/router.js", () => ({
  getOAuthProtectedResourceMetadataUrl: () =>
    new URL("https://mcp.example.test/.well-known/oauth-protected-resource/mcp"),
  mcpAuthRouter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js", () => ({
  requireBearerAuth: requireBearerAuthMock,
}));

vi.mock("../src/core/server.js", () => ({
  createServer: () => ({
    connect: connectServerMock,
    close: closeServerMock,
  }),
}));

vi.mock("../src/core/context.js", () => ({
  createExecutionContext: createExecutionContextMock,
}));

vi.mock("../src/auth/store-factory.js", () => ({
  getOAuthStore: vi.fn(async () => ({})),
}));

vi.mock("../src/auth/oauth-provider.js", () => ({
  UnipiazzaOAuthProvider: class MockUnipiazzaOAuthProvider {},
}));

async function runHandlers(handlers: Handler[], req: any, res: any) {
  let index = 0;

  const next = async (error?: unknown) => {
    if (error) {
      throw error;
    }

    const handler = handlers[index];
    index += 1;

    if (!handler) {
      return;
    }

    if (handler.length >= 3) {
      await handler(req, res, next);
      return;
    }

    await handler(req, res);
    await next();
  };

  await next();
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return {
        json: (body: unknown) => {
          this.body = body;
          this.headersSent = true;
        },
      };
    },
    end() {
      this.headersSent = true;
    },
  };
}

describe("remote HTTP MCP transport", () => {
  beforeEach(() => {
    vi.resetModules();
    handleRequestMock.mockReset();
    closeTransportMock.mockReset();
    connectServerMock.mockReset();
    closeServerMock.mockReset();
    requireBearerAuthMock.mockReset();
    createExecutionContextMock.mockClear();
    isInitializeRequestMock.mockReset();

    requireBearerAuthMock.mockImplementation(
      () => (req: any, _res: any, next: any) => {
        req.auth = {
          extra: {
            apiKey: "unp_test_key",
            authorizedShopIds: ["shop-1"],
            authMode: "oauth-access-token",
          },
        };
        return next();
      },
    );

    isInitializeRequestMock.mockImplementation(
      (body: any) => body?.method === "initialize",
    );

    handleRequestMock.mockImplementation(async (_req: any, res: any) => {
      res.statusCode = 204;
      res.end();
    });
  });

  it("allows authenticated GET requests on /mcp after session initialization", async () => {
    const { createRemoteHttpApp } = await import("../src/transports/http.js");
    const app: any = createRemoteHttpApp();
    const postHandlers = app.__routes.post.get("/mcp");
    const getHandlers = app.__routes.get.get("/mcp");

    expect(postHandlers).toBeTruthy();
    expect(getHandlers).toBeTruthy();

    const initializeReq = {
      method: "POST",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      },
      headers: {
        authorization: "Bearer token",
        accept: "application/json, text/event-stream",
      },
    };
    const initializeRes = createMockResponse();

    await runHandlers(postHandlers, initializeReq, initializeRes);

    const getReq = {
      method: "GET",
      body: undefined,
      headers: {
        accept: "text/event-stream",
        "mcp-session-id": "session-1",
      },
    };
    const getRes = createMockResponse();

    await runHandlers(getHandlers, getReq, getRes);

    expect(initializeRes.statusCode).toBe(204);
    expect(getRes.statusCode).toBe(204);
    expect(connectServerMock).toHaveBeenCalledOnce();
    expect(handleRequestMock).toHaveBeenCalledTimes(2);
    expect(requireBearerAuthMock).toHaveBeenCalledTimes(1);
    expect(closeTransportMock).not.toHaveBeenCalled();
    expect(closeServerMock).not.toHaveBeenCalled();
  });

  it("still rejects unsupported methods on /mcp", async () => {
    const { createRemoteHttpApp } = await import("../src/transports/http.js");
    const app: any = createRemoteHttpApp();
    const handlers = app.__routes.all.get("/mcp");

    expect(handlers).toBeTruthy();

    const res = createMockResponse();
    await runHandlers(handlers, { method: "PATCH" }, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({
      error: {
        message: "Method not allowed.",
      },
    });
  });
});
