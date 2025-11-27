import { assertEquals } from "@std/assert";
import { validateSearchConfig } from "./config.ts";
import { DEFAULT_SEARCH_CONFIG } from "./types.ts";

Deno.test("validateSearchConfig - returns errors for invalid config", () => {
  const errors = validateSearchConfig({
    model: "test",
    device: "invalid" as "webgpu",
    limit: -1,
    threshold: 2,
    alpha: 1.5,
    enableCache: true,
  });

  assertEquals(errors.length, 4);
  assertEquals(errors.some((e) => e.includes("limit")), true);
  assertEquals(errors.some((e) => e.includes("threshold")), true);
  assertEquals(errors.some((e) => e.includes("alpha")), true);
  assertEquals(errors.some((e) => e.includes("device")), true);
});

Deno.test("validateSearchConfig - returns empty array for valid config", () => {
  const errors = validateSearchConfig(DEFAULT_SEARCH_CONFIG);
  assertEquals(errors.length, 0);
});
