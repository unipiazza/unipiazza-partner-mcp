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

describe("campaignsHandlers", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("calls /campaigns for list_campaigns with pagination query", async () => {
    getMock.mockResolvedValue({
      campaigns: [
        { id: "c-1", campaign_type: "marketing" },
        { id: "c-2", campaign_type: "whatsapp" },
      ],
      page: 1,
      per_page: 25,
    });

    const { campaignsHandlers } = await import("../../src/tools/campaigns.ts");

    const result = await campaignsHandlers.list_campaigns(
      {
        shop_id: "shop-1",
        page: 1,
        per_page: 25,
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/campaigns?page=1&per_page=25",
      undefined,
      "shop-1",
    );
    expect(result).toContain('"campaign_type": "marketing"');
    expect(result).toContain('"campaign_type": "whatsapp"');
  });

  it("calls /campaigns/:id for get_campaign_details", async () => {
    getMock.mockResolvedValue({
      id: "campaign/with spaces",
      campaign_type: "marketing",
      users_count: 100,
    });

    const { campaignsHandlers } = await import("../../src/tools/campaigns.ts");

    const result = await campaignsHandlers.get_campaign_details(
      {
        shop_id: "shop-1",
        campaign_id: "campaign/with spaces",
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/campaigns/campaign%2Fwith%20spaces",
      undefined,
      "shop-1",
    );
    expect(result).toContain('"users_count": 100');
  });

  it("calls /campaigns/:id/recipients with full query for list_campaign_recipients", async () => {
    getMock.mockResolvedValue({
      campaign_type: "marketing",
      users_count: 2,
      page: 2,
      per_page: 10,
      users: [{ id: "u-1" }, { id: "u-2" }],
    });

    const { campaignsHandlers } = await import("../../src/tools/campaigns.ts");

    const result = await campaignsHandlers.list_campaign_recipients(
      {
        shop_id: "shop-1",
        campaign_id: "campaign-1",
        page: 2,
        per_page: 10,
        sorting_by: "generated_euros",
        sorting_descending: true,
        filter: "promo_delivered",
        q: "mario",
      },
      ctx,
    );

    expect(getMock).toHaveBeenCalledWith(
      "/campaigns/campaign-1/recipients?page=2&per_page=10&sorting_by=generated_euros&sorting_descending=true&filter=promo_delivered&q=mario",
      undefined,
      "shop-1",
    );
    expect(result).toContain('"campaign_type": "marketing"');
    expect(result).toContain('"users_count": 2');
    expect(result).toContain('"page": 2');
    expect(result).toContain('"per_page": 10');
    expect(result).toContain('"users": [');
  });
});
