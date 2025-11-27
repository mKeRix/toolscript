import { assertEquals, assertExists } from "@std/assert";
import { computeConfigHash, EmbeddingCache } from "./cache.ts";
import type { ToolMetadata } from "./types.ts";

Deno.test("EmbeddingCache - basic operations", async (t) => {
  const testDir = await Deno.makeTempDir();
  const cache = new EmbeddingCache(
    "test-model",
    "test-hash",
    testDir,
  );

  const tool: ToolMetadata = {
    serverName: "test-server",
    toolName: "test-tool",
    toolId: "test-server__test-tool",
    description: "Test tool description",
    inputSchema: { type: "object" },
  };

  const embedding = new Float32Array([0.1, 0.2, 0.3]);

  await t.step("initialize cache", async () => {
    await cache.initialize();
  });

  await t.step("set and get embedding", () => {
    cache.set(tool, embedding);
    const retrieved = cache.get(tool);
    assertExists(retrieved);
    assertEquals(retrieved.length, 3);
    // Float32Array has precision limitations, so check approximate equality
    const values = Array.from(retrieved);
    assertEquals(Math.abs(values[0] - 0.1) < 0.001, true);
    assertEquals(Math.abs(values[1] - 0.2) < 0.001, true);
    assertEquals(Math.abs(values[2] - 0.3) < 0.001, true);
  });

  await t.step("save and load cache", async () => {
    await cache.save();

    const cache2 = new EmbeddingCache(
      "test-model",
      "test-hash",
      testDir,
    );
    await cache2.initialize();

    const retrieved = cache2.get(tool);
    assertExists(retrieved);
    const values = Array.from(retrieved);
    assertEquals(Math.abs(values[0] - 0.1) < 0.001, true);
    assertEquals(Math.abs(values[1] - 0.2) < 0.001, true);
    assertEquals(Math.abs(values[2] - 0.3) < 0.001, true);
  });

  await t.step("invalidate on metadata change", () => {
    const modifiedTool: ToolMetadata = {
      ...tool,
      description: "Modified description",
    };

    const retrieved = cache.get(modifiedTool);
    assertEquals(retrieved, null);
  });

  await t.step("clear cache", async () => {
    await cache.clear();
    const stats = cache.getStats();
    assertEquals(stats.size, 0);
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});

Deno.test("computeConfigHash - generates consistent hashes", () => {
  const servers1 = ["server-a", "server-b", "server-c"];
  const servers2 = ["server-c", "server-a", "server-b"]; // Different order
  const servers3 = ["server-a", "server-b"]; // Different content

  const hash1 = computeConfigHash(servers1);
  const hash2 = computeConfigHash(servers2);
  const hash3 = computeConfigHash(servers3);

  assertEquals(hash1, hash2); // Order shouldn't matter
  assertEquals(hash1 !== hash3, true); // Different content should produce different hash
});
