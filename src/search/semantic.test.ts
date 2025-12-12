import { assertEquals, assertRejects } from "@std/assert";
import { assertSpyCall, assertSpyCalls, returnsNext, stub } from "@std/testing/mock";
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

Deno.test({
  name: "SemanticEngine - auto mode falls back to CPU when WebGPU fails",
  async fn() {
    // Mock navigator.gpu to simulate WebGPU availability
    const originalNavigator = globalThis.navigator;
    (globalThis as unknown as { navigator: unknown }).navigator = { gpu: {} };

    try {
      const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "auto");

      // Get the expected model cache directory
      const expectedCacheDir = Deno.env.get("HOME")
        ? `${Deno.env.get("HOME")}/.toolscript/models`
        : "./.toolscript/models";

      // Create a mock pipeline function that fails on WebGPU but succeeds on CPU
      const mockPipeline = stub(
        // deno-lint-ignore no-explicit-any
        engine as any,
        "createPipeline",
        returnsNext([
          // First call (WebGPU) - throw error simulating WebGPU backend not found
          Promise.reject(
            new Error(
              "no available backend found. ERR: [webgpu] backend not found.",
            ),
          ),
          // Second call (CPU) - return a mock pipeline
          Promise.resolve({
            // Mock FeatureExtractionPipeline
            dispose: () => {},
          }),
        ]),
      );

      try {
        await engine.initialize();

        // Verify initialization succeeded despite WebGPU failure
        assertEquals(engine.isInitialized(), true);

        // Verify the actual device used is CPU (fallback)
        assertEquals(engine.getActualDevice(), "cpu");

        // Verify createPipeline was called twice (WebGPU attempt + CPU fallback)
        assertSpyCalls(mockPipeline, 2);

        // Verify first call was with webgpu
        assertSpyCall(mockPipeline, 0, {
          args: ["webgpu", expectedCacheDir],
        });

        // Verify second call was with cpu (fallback)
        assertSpyCall(mockPipeline, 1, {
          args: ["cpu", expectedCacheDir],
        });
      } finally {
        mockPipeline.restore();
      }
    } finally {
      // Restore original navigator
      (globalThis as unknown as { navigator: unknown }).navigator = originalNavigator;
    }
  },
});

Deno.test({
  name: "SemanticEngine - explicit webgpu mode throws when pipeline fails",
  async fn() {
    const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "webgpu");

    // Mock createPipeline to fail
    const mockPipeline = stub(
      // deno-lint-ignore no-explicit-any
      engine as any,
      "createPipeline",
      returnsNext([
        Promise.reject(
          new Error("no available backend found. ERR: [webgpu] backend not found."),
        ),
      ]),
    );

    try {
      // Should throw because we explicitly requested webgpu and there's no fallback
      await assertRejects(
        async () => await engine.initialize(),
        Error,
        "no available backend found",
      );

      // Verify initialization failed
      assertEquals(engine.isInitialized(), false);

      // Verify createPipeline was called only once (no fallback for explicit mode)
      assertSpyCalls(mockPipeline, 1);
    } finally {
      mockPipeline.restore();
    }
  },
});
