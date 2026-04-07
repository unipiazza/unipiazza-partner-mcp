import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidGrantError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

const {
  initBackendAuthSessionMock,
  pollBackendAuthSessionMock,
  resolveAuthorizedShopIdsMock,
} = vi.hoisted(() => ({
  initBackendAuthSessionMock: vi.fn(),
  pollBackendAuthSessionMock: vi.fn(),
  resolveAuthorizedShopIdsMock: vi.fn(),
}));

vi.mock("../src/auth/backend-auth.js", () => ({
  initBackendAuthSession: initBackendAuthSessionMock,
  pollBackendAuthSession: pollBackendAuthSessionMock,
  resolveAuthorizedShopIds: resolveAuthorizedShopIdsMock,
}));

describe("remote OAuth provider", () => {
  beforeEach(() => {
    initBackendAuthSessionMock.mockReset();
    pollBackendAuthSessionMock.mockReset();
    resolveAuthorizedShopIdsMock.mockReset();
  });

  it("redirects authorize requests to the Unipiazza auth flow with a return_to URL", async () => {
    initBackendAuthSessionMock.mockResolvedValue({
      session_id: "backend-session",
      auth_url: "https://partner.example.test/mcp-auth?session=backend-session",
    });

    const { InMemoryOAuthStore } = await import("../src/auth/oauth-store.ts");
    const { UnipiazzaOAuthProvider } = await import(
      "../src/auth/oauth-provider.ts"
    );

    const store = new InMemoryOAuthStore();
    const provider = new UnipiazzaOAuthProvider(
      store,
      new URL("https://mcp.example.test"),
    );

    let redirectUrl = "";

    await provider.authorize(
      {
        client_id: "client-1",
        redirect_uris: [new URL("https://client.example.test/callback")],
        token_endpoint_auth_method: "none",
      },
      {
        codeChallenge: "challenge",
        redirectUri: "https://client.example.test/callback",
        state: "state-1",
        scopes: ["mcp"],
      },
      {
        redirect(url: string) {
          redirectUrl = url;
        },
      } as never,
    );

    expect(initBackendAuthSessionMock).toHaveBeenCalledOnce();
    expect(redirectUrl).toContain(
      "https://partner.example.test/mcp-auth?session=backend-session",
    );
    expect(redirectUrl).toContain(
      encodeURIComponent("https://mcp.example.test/oauth/authorize/complete/"),
    );
  });

  it("completes a pending authorization by turning the backend api key into an auth code", async () => {
    pollBackendAuthSessionMock.mockResolvedValue({
      status: "complete",
      api_key: "unp_backend_key",
    });
    resolveAuthorizedShopIdsMock.mockResolvedValue(["shop-1", "shop-2"]);

    const { InMemoryOAuthStore } = await import("../src/auth/oauth-store.ts");
    const { UnipiazzaOAuthProvider } = await import(
      "../src/auth/oauth-provider.ts"
    );

    const store = new InMemoryOAuthStore();
    const provider = new UnipiazzaOAuthProvider(
      store,
      new URL("https://mcp.example.test"),
    );
    const pending = await store.createPendingAuthorization({
      clientId: "client-1",
      redirectUri: "https://client.example.test/callback",
      state: "state-1",
      scopes: ["mcp"],
      resource: "https://mcp.example.test/mcp",
      codeChallenge: "challenge",
      backendSessionId: "backend-session",
      authUrl: "https://partner.example.test/mcp-auth?session=backend-session",
    });

    const result = await provider.completePendingAuthorization(pending.id);

    expect(result.status).toBe("complete");
    expect(result.redirectUrl).toContain("https://client.example.test/callback");
    expect(result.redirectUrl).toContain("code=");
    expect(result.redirectUrl).toContain("state=state-1");
  });

  it("exchanges auth codes for opaque OAuth access tokens and verifies them", async () => {
    const { InMemoryOAuthStore } = await import("../src/auth/oauth-store.ts");
    const { UnipiazzaOAuthProvider } = await import(
      "../src/auth/oauth-provider.ts"
    );

    const store = new InMemoryOAuthStore();
    const provider = new UnipiazzaOAuthProvider(
      store,
      new URL("https://mcp.example.test"),
    );
    const code = await store.createAuthorizationCode({
      clientId: "client-1",
      redirectUri: "https://client.example.test/callback",
      state: "state-1",
      scopes: ["mcp"],
      resource: "https://mcp.example.test/mcp",
      codeChallenge: "challenge",
      apiKey: "unp_backend_key",
      authorizedShopIds: ["shop-1"],
    });

    const tokens = await provider.exchangeAuthorizationCode(
      {
        client_id: "client-1",
        redirect_uris: [new URL("https://client.example.test/callback")],
        token_endpoint_auth_method: "none",
      },
      code.code,
      "verifier",
      "https://client.example.test/callback",
      new URL("https://mcp.example.test/mcp"),
    );

    expect(tokens.token_type).toBe("Bearer");
    expect(tokens.access_token).not.toBe("unp_backend_key");

    const authInfo = await provider.verifyAccessToken(tokens.access_token);

    expect(authInfo.clientId).toBe("client-1");
    expect(authInfo.scopes).toEqual(["mcp"]);
    expect(authInfo.extra).toMatchObject({
      apiKey: "unp_backend_key",
      authorizedShopIds: ["shop-1"],
      authMode: "oauth-access-token",
    });
  });

  it("still accepts legacy MCP api keys for remote bearer auth", async () => {
    resolveAuthorizedShopIdsMock.mockResolvedValue(["shop-legacy"]);

    const { InMemoryOAuthStore } = await import("../src/auth/oauth-store.ts");
    const { UnipiazzaOAuthProvider } = await import(
      "../src/auth/oauth-provider.ts"
    );

    const provider = new UnipiazzaOAuthProvider(
      new InMemoryOAuthStore(),
      new URL("https://mcp.example.test"),
    );

    const authInfo = await provider.verifyAccessToken("unp_legacy_key");

    expect(authInfo.extra).toMatchObject({
      apiKey: "unp_legacy_key",
      authorizedShopIds: ["shop-legacy"],
      authMode: "legacy-api-key",
    });
  });

  it("returns invalid_grant semantics for unknown refresh tokens", async () => {
    const { InMemoryOAuthStore } = await import("../src/auth/oauth-store.ts");
    const { UnipiazzaOAuthProvider } = await import(
      "../src/auth/oauth-provider.ts"
    );

    const provider = new UnipiazzaOAuthProvider(
      new InMemoryOAuthStore(),
      new URL("https://mcp.example.test"),
    );

    await expect(
      provider.exchangeRefreshToken(
        {
          client_id: "client-1",
          redirect_uris: [new URL("https://client.example.test/callback")],
          token_endpoint_auth_method: "none",
        },
        "missing-refresh-token",
      ),
    ).rejects.toBeInstanceOf(InvalidGrantError);
  });
});
