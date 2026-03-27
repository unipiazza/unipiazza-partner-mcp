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

describe("usersHandlers", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("builds the expected query string for list_users", async () => {
    getMock.mockResolvedValue({ users: [] });

    const { usersHandlers } = await import("../../src/tools/users.ts");

    const result = await usersHandlers.list_users(
      {
        shop_id: "shop-1",
        page: 2,
        per_page: 50,
        sorting_by: "coins",
        sorting_descending: false,
        filter_by: "vip",
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/users?page=2&per_page=50&sorting_by=coins&sorting_descending=false&filter_by=vip",
      undefined,
      "shop-1",
    );
    expect(result).toBe('{\n  "users": []\n}');
  });

  it("fails fast when search_users is called without query", async () => {
    const { usersHandlers } = await import("../../src/tools/users.ts");

    await expect(
      usersHandlers.search_users({ shop_id: "shop-1" }, ctx),
    ).rejects.toThrow("Missing required argument 'query'");
  });

  it("encodes user_id in get_user_details", async () => {
    getMock.mockResolvedValue({ id: "ok" });

    const { usersHandlers } = await import("../../src/tools/users.ts");

    await usersHandlers.get_user_details(
      {
        shop_id: "shop-1",
        user_id: "user/with spaces",
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/users/user%2Fwith%20spaces",
      undefined,
      "shop-1",
    );
  });

  it("uses default pagination for get_user_history", async () => {
    getMock.mockResolvedValue({ history: [] });

    const { usersHandlers } = await import("../../src/tools/users.ts");

    await usersHandlers.get_user_history(
      {
        shop_id: "shop-1",
        user_id: "user-1",
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/users/user-1/history?page=0&per_page=20",
      undefined,
      "shop-1",
    );
  });
});
