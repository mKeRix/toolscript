import { assertEquals } from "@std/assert";
import { FuzzyEngine } from "./fuzzy.ts";
import type { ToolMetadata } from "./types.ts";

Deno.test("FuzzyEngine - basic search", () => {
  const engine = new FuzzyEngine();

  const tools: ToolMetadata[] = [
    {
      serverName: "filesystem",
      toolName: "read_file",
      toolId: "filesystem__read_file",
      description: "Read contents of a file",
    },
    {
      serverName: "filesystem",
      toolName: "write_file",
      toolId: "filesystem__write_file",
      description: "Write contents to a file",
    },
    {
      serverName: "github",
      toolName: "create_repository",
      toolId: "github__create_repository",
      description: "Create a new GitHub repository",
    },
    {
      serverName: "git",
      toolName: "commit",
      toolId: "git__commit",
      description: "Commit changes to git repository",
    },
  ];

  engine.initialize(tools);

  const tests = [
    {
      name: "exact tool name match",
      query: "read_file",
      expectedTopResult: "filesystem__read_file",
    },
    {
      name: "partial tool name match",
      query: "read",
      expectedTopResult: "filesystem__read_file",
    },
    {
      name: "description match",
      query: "github repository",
      expectedTopResult: "github__create_repository",
    },
    {
      name: "typo tolerance",
      query: "read_fil", // Typo
      expectedTopResult: "filesystem__read_file",
    },
    {
      name: "server name match",
      query: "git",
      // Should match both git__commit and github__create_repository
      minResults: 1,
    },
  ];

  for (const test of tests) {
    const results = engine.search(test.query, 5);

    if (test.expectedTopResult) {
      assertEquals(
        results[0]?.toolId,
        test.expectedTopResult,
        `Test "${test.name}" failed: expected ${test.expectedTopResult}, got ${results[0]?.toolId}`,
      );
      assertEquals(
        results[0].score > 0,
        true,
        `Test "${test.name}" failed: score should be > 0`,
      );
    }

    if (test.minResults) {
      assertEquals(
        results.length >= test.minResults,
        true,
        `Test "${test.name}" failed: expected at least ${test.minResults} results, got ${results.length}`,
      );
    }
  }
});

Deno.test("FuzzyEngine - add and remove tools", () => {
  const engine = new FuzzyEngine();

  engine.initialize([
    {
      serverName: "test",
      toolName: "tool1",
      toolId: "test__tool1",
      description: "First tool",
    },
  ]);

  assertEquals(engine.getToolCount(), 1);

  engine.addTool({
    serverName: "test",
    toolName: "tool2",
    toolId: "test__tool2",
    description: "Second tool",
  });

  assertEquals(engine.getToolCount(), 2);

  const results = engine.search("tool2", 5);
  assertEquals(results.length > 0, true);
  assertEquals(results[0].toolId, "test__tool2");

  engine.removeTool("test__tool1");
  assertEquals(engine.getToolCount(), 1);

  engine.clear();
  assertEquals(engine.getToolCount(), 0);
});
