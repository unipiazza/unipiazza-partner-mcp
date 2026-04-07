import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (req: any, res: any, next?: any) => unknown;

const {
  handleRequestMock,
  closeTransportMock,
  connectServerMock,
  closeServerMock,
  requireBearerAuthMock,
  createExecutionContextMock,
} = vi.hoisted(() => ({
  handleRequestMock: vi.fn(),
  closeTransportMock: vi.fn(),
  connectServerMock: vi.fn(),
  closeServerMock: vi.fn(),
  requireBearerAuthMock: vi.fn(),
  createExecutionContextMock: vi.fn(() => ({})),
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class MockStreamableHTTPServerTransport {
    handleRequest = handleRequestMock;
    close = closeTransportMock;
  },
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

    handleRequestMock.mockImplementation(async (_req: any, res: any) => {
      res.statusCode = 204;
      res.end();
    });
  });

  it("allows authenticated GET requests on /mcp", async () => {
    const { createRemoteHttpApp } = await import("../src/transports/http.js");
    const app: any = createRemoteHttpApp();
    const handlers = app.__routes.get.get("/mcp");

    expect(handlers).toBeTruthy();

    const req = {
      method: "GET",
      body: undefined,
      headers: {
        accept: "text/event-stream",
        authorization: "Bearer token",
      },
    };
    const res = createMockResponse();

    await runHandlers(handlers, req, res);

    expect(res.statusCode).toBe(204);
    expect(handleRequestMock).toHaveBeenCalledOnce();
    expect(requireBearerAuthMock).toHaveBeenCalledOnce();
    expect(closeTransportMock).toHaveBeenCalledOnce();
    expect(closeServerMock).toHaveBeenCalledOnce();
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
