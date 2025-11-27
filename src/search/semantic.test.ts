import { assertEquals } from "@std/assert";
import { SemanticEngine } from "./semantic.ts";
import type { ToolMetadata } from "./types.ts";

Deno.test("SemanticEngine - without initialization throws error", async () => {
  const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");

  let error: Error | null = null;
  try {
    await engine.embed("test");
  } catch (e) {
    error = e as Error;
  }

  assertEquals(error !== null, true);
  assertEquals(error?.message.includes("not initialized"), true);
});

Deno.test("SemanticEngine - clear and remove tools", () => {
  const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");

  // Manually add embeddings for testing (without initialization)
  const embedding = new Float32Array(384);
  const tool: ToolMetadata = {
    serverName: "test",
    toolName: "test",
    toolId: "test__test",
    description: "test",
  };

  engine.indexEmbedding(tool, embedding);
  assertEquals(engine.getIndexSize(), 1);

  engine.removeTool("test__test");
  assertEquals(engine.getIndexSize(), 0);

  engine.indexEmbedding(tool, embedding);
  engine.clear();
  assertEquals(engine.getIndexSize(), 0);
});

Deno.test({
  name: "SemanticEngine - device configuration",
  fn() {
    // Verify different device options can be configured
    const engineAuto = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "auto");
    const engineWebGpu = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "webgpu");
    const engineCpu = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");

    assertEquals(engineAuto.isInitialized(), false);
    assertEquals(engineWebGpu.isInitialized(), false);
    assertEquals(engineCpu.isInitialized(), false);
  },
});
