import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExecutionContext } from "../../src/core/context.ts";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("../../src/api-client.js", () => ({
  createMcpApiClient: vi.fn(() => ({
    get: getMock,
  })),
  mcpClient: {
    get: getMock,
  },
}));

const ctx = createExecutionContext({
  authMode: "local-api-key",
  requestId: "test-request",
});

describe("shopHandlers", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("gets shop products without redemption counters", async () => {
    getMock.mockResolvedValue({ products: [] });

    const { shopHandlers } = await import("../../src/tools/shop.ts");

    await shopHandlers.get_shop_products({ shop_id: "shop-1" }, ctx);

    expect(getMock).toHaveBeenCalledWith("/products", undefined, "shop-1");
  });

  it("builds the expected query string for get_prize_stats", async () => {
    getMock.mockResolvedValue({ products: [] });

    const { shopHandlers } = await import("../../src/tools/shop.ts");

    await shopHandlers.get_prize_stats(
      {
        shop_id: "shop-1",
        start_date: "2026-01-01",
        end_date: "2026-06-04",
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/prize_stats?start_date=2026-01-01&end_date=2026-06-04",
      undefined,
      "shop-1",
    );
  });
});
