import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createMcpApiClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      API_BASE_URL: "http://example.test",
      PARTNER_API_KEY: "test-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("forwards params and the shop header", async () => {
    const get = vi.fn().mockResolvedValue({ data: { ok: true } });
    const create = vi.fn(() => ({ get }));

    vi.doMock("axios", () => ({
      default: { create },
    }));

    const { createMcpApiClient } = await import("../src/api-client.ts");
    const client = createMcpApiClient();

    await expect(
      client.get("/shops", { page: 1 }, "shop-123"),
    ).resolves.toEqual({ ok: true });

    expect(create).toHaveBeenCalledWith({
      baseURL: "http://example.test",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
    });

    expect(get).toHaveBeenCalledWith("/api/partner/mcp/shops", {
      params: { page: 1 },
      headers: { Accept: "sid=shop-123" },
    });
  });

  it("omits the Accept header when shop_id is missing", async () => {
    const get = vi.fn().mockResolvedValue({ data: { ok: true } });

    vi.doMock("axios", () => ({
      default: { create: vi.fn(() => ({ get })) },
    }));

    const { createMcpApiClient } = await import("../src/api-client.ts");
    const client = createMcpApiClient();

    await client.get("/ping");

    expect(get).toHaveBeenCalledWith("/api/partner/mcp/ping", {
      params: undefined,
      headers: {},
    });
  });

  it("wraps API response errors with status and payload", async () => {
    const get = vi.fn().mockRejectedValue({
      response: {
        status: 403,
        data: { message: "Forbidden" },
      },
    });

    vi.doMock("axios", () => ({
      default: { create: vi.fn(() => ({ get })) },
    }));

    const { createMcpApiClient } = await import("../src/api-client.ts");
    const client = createMcpApiClient();

    await expect(client.get("/shops")).rejects.toThrow(
      'API Error 403: {"message":"Forbidden"}',
    );
  });

  it("uses the explicit remote token when provided", async () => {
    const get = vi.fn().mockResolvedValue({ data: { ok: true } });
    const create = vi.fn(() => ({ get }));

    vi.doMock("axios", () => ({
      default: { create },
    }));

    const { createMcpApiClient } = await import("../src/api-client.ts");

    const client = createMcpApiClient("remote-token");
    await client.get("/shops");

    expect(create).toHaveBeenCalledWith({
      baseURL: "http://example.test",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer remote-token",
      },
    });
  });
});
