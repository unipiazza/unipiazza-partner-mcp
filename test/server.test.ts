import { afterEach, describe, expect, it } from "vitest";
import { createExecutionContext } from "../src/core/context.ts";
import { allHandlers, allTools } from "../src/tools/index.ts";
import {
  handleCallToolRequest,
  handleListToolsRequest,
} from "../src/server.ts";

const ctx = createExecutionContext({
  authMode: "local-api-key",
  requestId: "test-request",
});

describe("server handlers", () => {
  afterEach(() => {
    delete allHandlers.__test_success__;
    delete allHandlers.__test_failure__;
    for (let index = allTools.length - 1; index >= 0; index -= 1) {
      if (
        allTools[index].name === "__test_success__" ||
        allTools[index].name === "__test_failure__"
      ) {
        allTools.splice(index, 1);
      }
    }
  });

  it("returns the registered tool list", async () => {
    const response = await handleListToolsRequest();
    expect(response.tools).toBe(allTools);
  });

  it("reports unknown tools as MCP errors", async () => {
    const response = await handleCallToolRequest({
      params: { name: "missing_tool" },
    });

    expect(response).toEqual({
      content: [{ type: "text", text: "Unknown tool: missing_tool" }],
      isError: true,
    });
  });

  it("returns successful tool output as text content", async () => {
    allHandlers.__test_success__ = async () => '{"ok":true}';
    allTools.push({
      name: "__test_success__",
      description: "test tool",
      inputSchema: {
        type: "object",
        properties: {},
      },
    });

    const response = await handleCallToolRequest({
      params: { name: "__test_success__", arguments: { any: "value" } },
    });

    expect(response).toEqual({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
  });

  it("wraps handler failures in MCP error responses", async () => {
    allHandlers.__test_failure__ = async () => {
      throw new Error("boom");
    };
    allTools.push({
      name: "__test_failure__",
      description: "test tool",
      inputSchema: {
        type: "object",
        properties: {},
      },
    });

    const response = await handleCallToolRequest({
      params: { name: "__test_failure__" },
    });

    expect(response).toEqual({
      content: [{ type: "text", text: "Error executing __test_failure__: boom" }],
      isError: true,
    });
  });

  it("reports missing required shop_id before calling the handler", async () => {
    const response = await handleCallToolRequest(
      {
        params: { name: "get_server_status", arguments: {} },
      },
      ctx,
    );

    expect(response).toEqual({
      content: [{ type: "text", text: "Missing required argument 'shop_id'" }],
      isError: true,
    });
  });

  it("rejects unauthorized shop_id values from the execution context", async () => {
    const response = await handleCallToolRequest(
      {
        params: {
          name: "get_server_status",
          arguments: { shop_id: "shop-denied" },
        },
      },
      createExecutionContext({
        authMode: "remote-api-key",
        requestId: "test-request",
        authToken: "remote-token",
        authorizedShopIds: ["shop-allowed"],
      }),
    );

    expect(response).toEqual({
      content: [{ type: "text", text: "Unauthorized shop_id 'shop-denied'" }],
      isError: true,
    });
  });
});
