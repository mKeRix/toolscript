/**
 * Tests for Claude usage suggestion command
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import type { SearchResult } from "../../../search/types.ts";
import {
  createHookResponse,
  deduplicateAndSortTools,
  formatContextText,
} from "./claude-usage-suggestion.ts";

Deno.test("formatContextText should format skills correctly", () => {
  const result = formatContextText(["skill1", "skill2"], []);

  assertExists(result);
  assertStringIncludes(result, 'Skill("skill1")');
  assertStringIncludes(result, 'Skill("skill2")');
  assertStringIncludes(result, "The following skills may be helpful");
});

Deno.test("formatContextText should format tools correctly", () => {
  const mockTools: SearchResult[] = [
    {
      tool: {
        toolId: "tool1",
        serverName: "server1",
        toolName: "tool1",
        description: "First tool",
        inputSchema: {},
      },
      score: 0.9,
      scoreBreakdown: {
        semantic: 0.85,
        fuzzy: 0.95,
        combined: 0.9,
      },
    },
    {
      tool: {
        toolId: "tool2",
        serverName: "server1",
        toolName: "tool2",
        description: "Second tool",
        inputSchema: {},
      },
      score: 0.8,
      scoreBreakdown: {
        semantic: 0.75,
        fuzzy: 0.85,
        combined: 0.8,
      },
    },
  ];

  const result = formatContextText([], mockTools);

  assertExists(result);
  assertStringIncludes(result, "tool1");
  assertStringIncludes(result, "tool2");
  assertStringIncludes(result, 'Skill("toolscript")');
  assertStringIncludes(result, "MCP tools");
});

Deno.test("formatContextText should format both skills and tools", () => {
  const mockTools: SearchResult[] = [
    {
      tool: {
        toolId: "tool1",
        serverName: "server1",
        toolName: "tool1",
        description: "First tool",
        inputSchema: {},
      },
      score: 0.9,
      scoreBreakdown: {
        semantic: 0.85,
        fuzzy: 0.95,
        combined: 0.9,
      },
    },
  ];

  const result = formatContextText(["skill1"], mockTools);

  assertExists(result);
  assertStringIncludes(result, 'Skill("skill1")');
  assertStringIncludes(result, "tool1");
  assertEquals(result.includes("\n\n"), true); // Should have section separator
});

Deno.test("formatContextText should return empty string for no input", () => {
  const result = formatContextText([], []);
  assertEquals(result, "");
});

Deno.test("createHookResponse should return hookSpecificOutput for non-empty context", () => {
  const result = createHookResponse("test context");

  assertExists(result);
  assertEquals(typeof result, "object");

  // Check that hookSpecificOutput exists and has the right properties
  if ("hookSpecificOutput" in result && result.hookSpecificOutput) {
    assertEquals(result.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    // Type assertion needed because hookSpecificOutput is a union type
    const output = result.hookSpecificOutput as {
      hookEventName: string;
      additionalContext?: string;
    };
    assertEquals(output.additionalContext, "test context");
  } else {
    throw new Error("hookSpecificOutput should exist for non-empty context");
  }
});

Deno.test("createHookResponse should return empty object for empty context", () => {
  const result = createHookResponse("");

  assertExists(result);
  assertEquals(typeof result, "object");
  assertEquals(Object.keys(result).length, 0);
});

Deno.test("deduplicateAndSortTools should deduplicate by toolId and keep highest score", () => {
  const allTools: SearchResult[] = [
    {
      tool: {
        toolId: "tool1",
        serverName: "server1",
        toolName: "tool1",
        description: "",
        inputSchema: {},
      },
      score: 0.8,
      scoreBreakdown: { semantic: 0.7, fuzzy: 0.9, combined: 0.8 },
    },
    {
      tool: {
        toolId: "tool1",
        serverName: "server1",
        toolName: "tool1",
        description: "",
        inputSchema: {},
      },
      score: 0.9, // Higher score
      scoreBreakdown: { semantic: 0.85, fuzzy: 0.95, combined: 0.9 },
    },
    {
      tool: {
        toolId: "tool2",
        serverName: "server2",
        toolName: "tool2",
        description: "",
        inputSchema: {},
      },
      score: 0.7,
      scoreBreakdown: { semantic: 0.6, fuzzy: 0.8, combined: 0.7 },
    },
  ];

  const result = deduplicateAndSortTools(allTools);

  assertEquals(result.length, 2);

  // tool1 should have the higher score (0.9)
  const tool1 = result.find((t) => t.tool.toolId === "tool1");
  assertExists(tool1);
  assertEquals(tool1.score, 0.9);
});

Deno.test("deduplicateAndSortTools should sort by score and limit results", () => {
  const tools: SearchResult[] = [
    {
      tool: {
        toolId: "tool1",
        serverName: "server1",
        toolName: "tool1",
        description: "",
        inputSchema: {},
      },
      score: 0.5,
      scoreBreakdown: { semantic: 0.4, fuzzy: 0.6, combined: 0.5 },
    },
    {
      tool: {
        toolId: "tool2",
        serverName: "server2",
        toolName: "tool2",
        description: "",
        inputSchema: {},
      },
      score: 0.9,
      scoreBreakdown: { semantic: 0.85, fuzzy: 0.95, combined: 0.9 },
    },
    {
      tool: {
        toolId: "tool3",
        serverName: "server3",
        toolName: "tool3",
        description: "",
        inputSchema: {},
      },
      score: 0.7,
      scoreBreakdown: { semantic: 0.65, fuzzy: 0.75, combined: 0.7 },
    },
  ];

  const result = deduplicateAndSortTools(tools, 2);

  assertEquals(result.length, 2);
  assertEquals(result[0].tool.toolId, "tool2"); // Highest score
  assertEquals(result[1].tool.toolId, "tool3"); // Second highest
});
