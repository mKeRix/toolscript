import { assertEquals, assertExists } from "@std/assert";
import { SearchEngine } from "./engine.ts";
import type { ToolMetadata } from "./types.ts";

const testTools: ToolMetadata[] = [
  {
    serverName: "filesystem",
    toolName: "read_file",
    toolId: "filesystem__read_file",
    description: "Read contents of a file from disk",
  },
  {
    serverName: "filesystem",
    toolName: "write_file",
    toolId: "filesystem__write_file",
    description: "Write contents to a file on disk",
  },
  {
    serverName: "github",
    toolName: "create_repository",
    toolId: "github__create_repository",
    description: "Create a new repository on GitHub",
  },
  {
    serverName: "git",
    toolName: "commit",
    toolId: "git__commit",
    description: "Commit changes to a git repository",
  },
  {
    serverName: "desktop-commander",
    toolName: "execute_command",
    toolId: "desktop-commander__execute_command",
    description: "Execute a shell command on the system",
  },
];

Deno.test({
  name: "SearchEngine - fuzzy-only mode",
  // Disable resource sanitization due to native modules from transformers.js
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    const tempDir = await Deno.makeTempDir();
    const engine = new SearchEngine({
      enableCache: true,
      dataDir: tempDir,
      threshold: 0.1, // Lower threshold for fuzzy-only mode (no semantic scores)
    });

    await t.step("initialize without semantic (graceful degradation)", async () => {
      // This will load the semantic model if native modules are installed
      await engine.initialize(["filesystem", "github", "git"]);
      assertEquals(engine.isInitialized(), true);
      // Semantic may or may not be available depending on environment
    });

    await t.step("index tools", async () => {
      await engine.indexTools(testTools);
      const stats = engine.getStats();
      assertEquals(stats.toolsIndexed, 5);
    });

    await t.step("search for file operations", async () => {
      const results = await engine.search("read file", 3);
      assertEquals(results.length > 0, true);
      // read_file should be in top results
      const hasReadFile = results.some(
        (r) => r.tool.toolId === "filesystem__read_file",
      );
      assertEquals(hasReadFile, true);
    });

    await t.step("search for git operations", async () => {
      const results = await engine.search("git commit", 3);
      assertEquals(results.length > 0, true);
      const hasCommit = results.some((r) => r.tool.toolId === "git__commit");
      assertEquals(hasCommit, true);
    });

    await t.step("search with threshold filter", async () => {
      const results = await engine.search("xyz123nonexistent", 3, 0.5);
      // Should return no results due to high threshold
      assertEquals(results.length, 0);
    });

    await t.step("get tool by ID", () => {
      const tool = engine.getTool("filesystem__read_file");
      assertExists(tool);
      assertEquals(tool.toolName, "read_file");
    });

    await t.step("get all tools", () => {
      const allTools = engine.getAllTools();
      assertEquals(allTools.length, 5);
    });

    await t.step("remove tool", () => {
      engine.removeTool("desktop-commander__execute_command");
      const stats = engine.getStats();
      assertEquals(stats.toolsIndexed, 4);
    });

    await t.step("clear engine", async () => {
      await engine.clear();
      const stats = engine.getStats();
      assertEquals(stats.toolsIndexed, 0);
    });

    // Cleanup
    await Deno.remove(tempDir, { recursive: true });
  },
});

Deno.test({
  name: "SearchEngine - score breakdown",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tempDir = await Deno.makeTempDir();
    const engine = new SearchEngine({
      enableCache: false,
      dataDir: tempDir,
      threshold: 0.1,
    });

    await engine.initialize([]);
    await engine.indexTools(testTools);

    const results = await engine.search("read file");

    if (results.length > 0) {
      const first = results[0];
      assertExists(first.scoreBreakdown);
      assertEquals(typeof first.scoreBreakdown.fuzzy, "number");
      assertEquals(typeof first.scoreBreakdown.combined, "number");
      assertEquals(first.score, first.scoreBreakdown.combined);
    }

    await Deno.remove(tempDir, { recursive: true });
  },
});

Deno.test({
  name: "SearchEngine - search result has reason",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const tempDir = await Deno.makeTempDir();
    const engine = new SearchEngine({
      enableCache: false,
      dataDir: tempDir,
      threshold: 0.1,
    });

    await engine.initialize([]);
    await engine.indexTools(testTools);

    const results = await engine.search("read file");

    if (results.length > 0) {
      assertExists(results[0].reason);
      assertEquals(typeof results[0].reason, "string");
    }

    await Deno.remove(tempDir, { recursive: true });
  },
});

Deno.test({
  name: "SearchEngine - fuzzy-only mode uses full fuzzy score with default threshold",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // This test verifies that in fuzzy-only mode (when semantic is unavailable),
    // the engine uses alpha=0 so fuzzy scores get full weight, allowing results
    // to pass the default threshold of 0.35
    const tempDir = await Deno.makeTempDir();
    const engine = new SearchEngine({
      enableCache: false,
      dataDir: tempDir,
      // Use default threshold (0.35) - don't override it
    });

    await engine.initialize([]);

    // If semantic is available, skip this test (it's testing fuzzy-only behavior)
    if (engine.isSemanticAvailable()) {
      console.log("Skipping fuzzy-only test - semantic search is available");
      await Deno.remove(tempDir, { recursive: true });
      return;
    }

    await engine.indexTools(testTools);

    // With the fix: alpha=0 in fuzzy-only mode, so combined = 1.0 * fuzzy_score
    // Without the fix: alpha=0.7, so combined = 0.3 * fuzzy_score (max 0.3, below 0.35 threshold)
    const results = await engine.search("read file");

    // Should find results even with default threshold because fuzzy gets full weight
    assertEquals(
      results.length > 0,
      true,
      "Should return results with default threshold in fuzzy-only mode",
    );

    // Verify the combined score equals fuzzy score (alpha=0)
    const first = results[0];
    assertEquals(
      first.scoreBreakdown.combined,
      first.scoreBreakdown.fuzzy,
      "In fuzzy-only mode, combined score should equal fuzzy score",
    );

    await Deno.remove(tempDir, { recursive: true });
  },
});
