import { assertEquals } from "@std/assert";
import { SemanticEngine } from "./semantic.ts";
import type { ToolMetadata } from "./types.ts";

// Note: These tests may take a while on first run due to model download
// They are designed to be run manually during development

Deno.test({
  name: "SemanticEngine - basic initialization",
  ignore: true, // Skip by default due to model download time
  async fn() {
    const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");

    assertEquals(engine.isInitialized(), false);

    await engine.initialize();

    assertEquals(engine.isInitialized(), true);
  },
});

Deno.test({
  name: "SemanticEngine - embedding generation",
  ignore: true, // Skip by default due to model download time
  async fn() {
    const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");
    await engine.initialize();

    const embedding = await engine.embed("test query");

    assertEquals(embedding instanceof Float32Array, true);
    assertEquals(embedding.length, 384); // all-MiniLM-L6-v2 dimension
  },
});

Deno.test({
  name: "SemanticEngine - tool indexing and search",
  ignore: true, // Skip by default due to model download time
  async fn() {
    const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");
    await engine.initialize();

    const tools: ToolMetadata[] = [
      {
        serverName: "filesystem",
        toolName: "read_file",
        toolId: "filesystem__read_file",
        description: "Read contents of a file from disk",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read" },
            encoding: { type: "string", description: "Text encoding format" },
          },
        },
      },
      {
        serverName: "github",
        toolName: "create_repository",
        toolId: "github__create_repository",
        description: "Create a new repository on GitHub",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Repository name" },
            private: { type: "boolean" },
          },
        },
      },
    ];

    // Index tools
    for (const tool of tools) {
      await engine.indexTool(tool);
    }

    assertEquals(engine.getIndexSize(), 2);

    // Search for file-related tools
    const results = await engine.findSimilar("read a file", 2);

    assertEquals(results.length, 2);
    // File reading tool should be first
    assertEquals(results[0].toolId, "filesystem__read_file");
    assertEquals(results[0].score > results[1].score, true);
  },
});

Deno.test({
  name: "SemanticEngine - search with input schema parameters",
  ignore: true, // Skip by default due to model download time
  async fn() {
    const engine = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");
    await engine.initialize();

    const tools: ToolMetadata[] = [
      {
        serverName: "search",
        toolName: "web_search",
        toolId: "search__web_search",
        description: "Search the web",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string" },
            limit: { type: "number", description: "Maximum number of results" },
          },
        },
      },
      {
        serverName: "files",
        toolName: "list_files",
        toolId: "files__list_files",
        description: "List files in directory",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path" },
          },
        },
      },
    ];

    // Index tools
    for (const tool of tools) {
      await engine.indexTool(tool);
    }

    // Search using parameter-related query
    // Should find web_search because it has "query" and "limit" parameters
    const results = await engine.findSimilar("tool with query and limit parameters", 2);

    assertEquals(results.length, 2);
    // web_search should rank higher due to matching parameter names
    assertEquals(results[0].toolId, "search__web_search");
  },
});

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
    const engineCpu = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "cpu");
    const engineGpu = new SemanticEngine("Xenova/all-MiniLM-L6-v2", "gpu");

    assertEquals(engineAuto.isInitialized(), false);
    assertEquals(engineCpu.isInitialized(), false);
    assertEquals(engineGpu.isInitialized(), false);
  },
});
