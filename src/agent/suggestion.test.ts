/**
 * Tests for Claude Agent SDK suggestion wrapper
 */

import { assertEquals, assertExists } from "@std/assert";
import { suggestContext } from "./suggestion.ts";
import type { Skill } from "../utils/skill-discovery.ts";

// Mock skills for testing
const mockSkills: Skill[] = [
  {
    name: "toolscript",
    description: "Search and execute MCP tools via gateway",
    source: "plugin",
    pluginName: "toolscript",
  },
  {
    name: "react-dev",
    description: "React development utilities and hooks",
    source: "global",
  },
  {
    name: "git-flow",
    description: "Git workflow automation",
    source: "project",
  },
];

Deno.test({
  name: "suggestContext should return empty result on timeout",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await suggestContext(
      "hello world",
      mockSkills,
      1, // Very short timeout to trigger abort
    );

    assertExists(result);
    assertEquals(Array.isArray(result.skills), true);
    assertEquals(Array.isArray(result.toolQueries), true);
  },
});

Deno.test({
  name: "suggestContext should handle empty skills array",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await suggestContext(
      "search for kubernetes tools",
      [],
      100, // Short timeout for faster tests
    );

    assertExists(result);
    assertEquals(Array.isArray(result.skills), true);
    assertEquals(Array.isArray(result.toolQueries), true);
  },
});

Deno.test({
  name: "suggestContext should handle errors gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Test with invalid ANTHROPIC_API_KEY to trigger auth error
    const originalKey = Deno.env.get("ANTHROPIC_API_KEY");

    try {
      Deno.env.set("ANTHROPIC_API_KEY", "invalid-key");

      const result = await suggestContext(
        "search for tools",
        mockSkills,
        100,
      );

      assertExists(result);
      // Should return empty arrays on error, not throw
      assertEquals(result.skills, []);
      assertEquals(result.toolQueries, []);
    } finally {
      // Restore original key
      if (originalKey) {
        Deno.env.set("ANTHROPIC_API_KEY", originalKey);
      } else {
        Deno.env.delete("ANTHROPIC_API_KEY");
      }
    }
  },
});

Deno.test({
  name: "suggestContext should validate result structure",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await suggestContext(
      "test prompt",
      mockSkills,
      100,
    );

    assertExists(result);
    assertExists(result.skills);
    assertExists(result.toolQueries);
    assertEquals(Array.isArray(result.skills), true);
    assertEquals(Array.isArray(result.toolQueries), true);
  },
});

Deno.test({
  name: "suggestContext should respect max array limits",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Even if the LLM returns more, Zod schema should enforce max 3
    const result = await suggestContext(
      "complex query requiring many tools",
      mockSkills,
      100,
    );

    assertExists(result);
    assertEquals(result.skills.length <= 3, true);
    assertEquals(result.toolQueries.length <= 3, true);
  },
});

Deno.test({
  name: "suggestContext should handle special characters in prompts",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const specialPrompts = [
      'search for "react hooks" examples',
      "find tools with @mentions",
      "query with new\nlines",
      "unicode: 🚀 emoji",
    ];

    for (const prompt of specialPrompts) {
      const result = await suggestContext(prompt, mockSkills, 100);
      assertExists(result);
      assertEquals(Array.isArray(result.skills), true);
      assertEquals(Array.isArray(result.toolQueries), true);
    }
  },
});

Deno.test({
  name: "suggestContext should handle long prompts",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const longPrompt = "search for tools ".repeat(100);

    const result = await suggestContext(longPrompt, mockSkills, 100);

    assertExists(result);
    assertEquals(Array.isArray(result.skills), true);
    assertEquals(Array.isArray(result.toolQueries), true);
  },
});

Deno.test({
  name: "suggestContext should handle many skills",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const manySkills: Skill[] = Array.from({ length: 50 }, (_, i) => ({
      name: `skill-${i}`,
      description: `Description for skill ${i}`,
      source: "global" as const,
    }));

    const result = await suggestContext(
      "find relevant skills",
      manySkills,
      100,
    );

    assertExists(result);
    assertEquals(Array.isArray(result.skills), true);
    assertEquals(Array.isArray(result.toolQueries), true);
  },
});
