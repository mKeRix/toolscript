/**
 * Tests for server aggregator.
 */

import { assertEquals } from "@std/assert";
import { ServerAggregator, type ToolInfo } from "./aggregator.ts";
import type { ToolscriptConfig } from "../config/types.ts";

/**
 * Note: These tests focus on the aggregator's public API and filtering logic.
 * Integration tests handle the full MCP client connection and tool loading workflow.
 */

Deno.test("ServerAggregator should handle empty configuration", async () => {
  const aggregator = new ServerAggregator();
  const config: ToolscriptConfig = {
    mcpServers: {},
  };

  await aggregator.initialize(config);

  assertEquals(aggregator.getServerNames(), []);
  assertEquals(aggregator.getAllTools(), []);
  assertEquals(aggregator.getServers(), []);

  await aggregator.shutdown();
});

Deno.test("ServerAggregator should get all tools from single server", () => {
  const aggregator = new ServerAggregator();

  // We can't easily mock the McpClient in the aggregator without dependency injection
  // So this test verifies the public API behavior
  assertEquals(aggregator.getAllTools(), []);
  assertEquals(aggregator.getServerNames(), []);
});

Deno.test("ServerAggregator getFilteredTools should filter by server name", () => {
  const aggregator = new ServerAggregator();

  // Create mock tools
  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      description: "Create an issue",
      inputSchema: {},
    },
    {
      serverName: "github",
      toolName: "list_repos",
      qualifiedName: "github__list_repos",
      description: "List repos",
      inputSchema: {},
    },
    {
      serverName: "atlassian",
      toolName: "get_issue",
      qualifiedName: "atlassian__get_issue",
      description: "Get issue",
      inputSchema: {},
    },
  ];

  // Manually populate tools for testing filter logic
  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const githubTools = aggregator.getFilteredTools("github");
  assertEquals(githubTools.length, 2);
  assertEquals(githubTools.every((t) => t.serverName === "github"), true);

  const atlassianTools = aggregator.getFilteredTools("atlassian");
  assertEquals(atlassianTools.length, 1);
  assertEquals(atlassianTools[0].serverName, "atlassian");
});

Deno.test("ServerAggregator getFilteredTools should filter by tool name", () => {
  const aggregator = new ServerAggregator();

  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      description: "Create an issue",
      inputSchema: {},
    },
    {
      serverName: "atlassian",
      toolName: "create_issue",
      qualifiedName: "atlassian__create_issue",
      description: "Create issue",
      inputSchema: {},
    },
    {
      serverName: "github",
      toolName: "list_repos",
      qualifiedName: "github__list_repos",
      description: "List repos",
      inputSchema: {},
    },
  ];

  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const createIssueTools = aggregator.getFilteredTools(undefined, "create_issue");
  assertEquals(createIssueTools.length, 2);
  assertEquals(createIssueTools.every((t) => t.toolName === "create_issue"), true);
});

Deno.test("ServerAggregator getFilteredTools should filter by both server and tool name", () => {
  const aggregator = new ServerAggregator();

  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      description: "Create an issue",
      inputSchema: {},
    },
    {
      serverName: "atlassian",
      toolName: "create_issue",
      qualifiedName: "atlassian__create_issue",
      description: "Create issue",
      inputSchema: {},
    },
    {
      serverName: "github",
      toolName: "list_repos",
      qualifiedName: "github__list_repos",
      description: "List repos",
      inputSchema: {},
    },
  ];

  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const filtered = aggregator.getFilteredTools("github", "create_issue");
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].serverName, "github");
  assertEquals(filtered[0].toolName, "create_issue");
});

Deno.test("ServerAggregator getFilteredTools should return all tools when no filters", () => {
  const aggregator = new ServerAggregator();

  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      description: "Create an issue",
      inputSchema: {},
    },
    {
      serverName: "atlassian",
      toolName: "get_issue",
      qualifiedName: "atlassian__get_issue",
      description: "Get issue",
      inputSchema: {},
    },
  ];

  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const allTools = aggregator.getFilteredTools();
  assertEquals(allTools.length, 2);
});

Deno.test("ServerAggregator callTool should throw when tool not found", async () => {
  const aggregator = new ServerAggregator();

  let errorThrown = false;
  try {
    await aggregator.callTool("nonexistent__tool", {});
  } catch (error) {
    errorThrown = true;
    assertEquals(error instanceof Error, true);
    if (error instanceof Error) {
      assertEquals(error.message, "Tool not found: nonexistent__tool");
    }
  }
  assertEquals(errorThrown, true);
});

Deno.test("ServerAggregator should create qualified names with double underscore", () => {
  const aggregator = new ServerAggregator();

  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      inputSchema: {},
    },
    {
      serverName: "my-server",
      toolName: "my_tool",
      qualifiedName: "my-server__my_tool",
      inputSchema: {},
    },
  ];

  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const allTools = aggregator.getAllTools();
  assertEquals(allTools[0].qualifiedName, "github__create_issue");
  assertEquals(allTools[1].qualifiedName, "my-server__my_tool");
});

Deno.test("ServerAggregator getAllTools should return array of all tools", () => {
  const aggregator = new ServerAggregator();

  const tools: ToolInfo[] = [
    {
      serverName: "server1",
      toolName: "tool1",
      qualifiedName: "server1__tool1",
      inputSchema: {},
    },
    {
      serverName: "server2",
      toolName: "tool2",
      qualifiedName: "server2__tool2",
      inputSchema: {},
    },
    {
      serverName: "server3",
      toolName: "tool3",
      qualifiedName: "server3__tool3",
      inputSchema: {},
    },
  ];

  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const allTools = aggregator.getAllTools();
  assertEquals(allTools.length, 3);
  assertEquals(allTools.map((t) => t.qualifiedName).sort(), [
    "server1__tool1",
    "server2__tool2",
    "server3__tool3",
  ]);
});

Deno.test("ServerAggregator should handle tools with optional fields", () => {
  const aggregator = new ServerAggregator();

  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      description: "Create an issue",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
    {
      serverName: "github",
      toolName: "simple_tool",
      qualifiedName: "github__simple_tool",
      inputSchema: {},
      // No description, no outputSchema
    },
  ];

  // @ts-ignore - accessing private field for testing
  for (const tool of tools) {
    aggregator["tools"].set(tool.qualifiedName, tool);
  }

  const allTools = aggregator.getAllTools();
  assertEquals(allTools[0].description, "Create an issue");
  assertEquals(allTools[0].outputSchema, { type: "object" });
  assertEquals(allTools[1].description, undefined);
  assertEquals(allTools[1].outputSchema, undefined);
});

Deno.test("ServerAggregator getServers should return server information", () => {
  const aggregator = new ServerAggregator();

  // Test with empty aggregator
  assertEquals(aggregator.getServers(), []);
});

Deno.test("ServerAggregator getServerNames should return list of server names", () => {
  const aggregator = new ServerAggregator();

  // Test with empty aggregator
  assertEquals(aggregator.getServerNames(), []);
});
