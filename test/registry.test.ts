import { describe, expect, it } from "vitest";
import { allHandlers, allTools } from "../src/tools/index.ts";

describe("tool registry", () => {
  it("exposes unique tool names", () => {
    const names = allTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has a handler for every declared tool", () => {
    for (const tool of allTools) {
      expect(allHandlers[tool.name], `Missing handler for ${tool.name}`).toBeTypeOf(
        "function",
      );
    }
  });
});
