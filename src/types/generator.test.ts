/**
 * Tests for type generation.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { generateToolsModule, TypeCache } from "./generator.ts";
import type { ToolInfo } from "../gateway/aggregator.ts";

Deno.test("generateToolsModule should generate empty module when no tools", async () => {
  const module = await generateToolsModule([], "http://localhost:3000");
  assertStringIncludes(module, "export const tools = {};");
});

Deno.test("generateToolsModule should generate module with single tool", async () => {
  const tools: ToolInfo[] = [
    {
      serverName: "github",
      toolName: "create_issue",
      qualifiedName: "github__create_issue",
      description: "Create a GitHub issue",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["title"],
      },
      outputSchema: {
        type: "object",
        properties: {
          id: { type: "number" },
          url: { type: "string" },
        },
      },
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Check for TypeScript types
  assertStringIncludes(module, "GithubCreateIssueParams");
  assertStringIncludes(module, "GithubCreateIssueResult");

  // Check for tools object structure
  assertStringIncludes(module, "export const tools = {");
  assertStringIncludes(module, "github: {");
  assertStringIncludes(module, "async createIssue(params: GithubCreateIssueParams)");

  // Check for description comment
  assertStringIncludes(module, "/** Create a GitHub issue */");

  // Check for gateway URL usage
  assertStringIncludes(module, 'Deno.env.get("TOOLSCRIPT_GATEWAY_URL")');
  assertStringIncludes(module, "/tools/github__create_issue");
});

Deno.test("generateToolsModule should handle multiple servers", async () => {
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
      serverName: "atlassian",
      toolName: "get_issue",
      qualifiedName: "atlassian__get_issue",
      description: "Get an issue",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Check for both namespaces
  assertStringIncludes(module, "github: {");
  assertStringIncludes(module, "atlassian: {");

  // Check for both functions
  assertStringIncludes(module, "createIssue");
  assertStringIncludes(module, "getIssue");
});

Deno.test("generateToolsModule should handle multiple tools per server", async () => {
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
      toolName: "list_repos",
      qualifiedName: "github__list_repos",
      description: "List repositories",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Should have one github namespace
  const githubMatches = module.match(/github: \{/g);
  assertEquals(githubMatches?.length, 1);

  // Should have both functions
  assertStringIncludes(module, "createIssue");
  assertStringIncludes(module, "listRepos");
});

Deno.test("generateToolsModule should handle tools without inputSchema", async () => {
  const tools: ToolInfo[] = [
    {
      serverName: "test",
      toolName: "simple",
      qualifiedName: "test__simple",
      description: "Simple tool",
      inputSchema: undefined,
      outputSchema: { type: "object" },
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Should generate empty interface for params
  assertStringIncludes(module, "interface TestSimpleParams {}");
});

Deno.test("generateToolsModule should handle tools without outputSchema", async () => {
  const tools: ToolInfo[] = [
    {
      serverName: "test",
      toolName: "simple",
      qualifiedName: "test__simple",
      description: "Simple tool",
      inputSchema: { type: "object" },
      outputSchema: undefined,
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Should generate generic result interface
  assertStringIncludes(module, "interface TestSimpleResult {");
  assertStringIncludes(module, "[key: string]: unknown;");
});

Deno.test("generateToolsModule should handle naming conventions", async () => {
  const tools: ToolInfo[] = [
    {
      serverName: "my-api-server",
      toolName: "get_user_profile",
      qualifiedName: "my-api-server__get_user_profile",
      description: "Get user profile",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Check TypeScript naming conventions
  assertStringIncludes(module, "myApiServer: {"); // camelCase namespace
  assertStringIncludes(module, "async getUserProfile("); // camelCase function
  assertStringIncludes(module, "MyApiServerGetUserProfileParams"); // PascalCase type
  assertStringIncludes(module, "MyApiServerGetUserProfileResult"); // PascalCase type
});

Deno.test("generateToolsModule should handle MCP response format with outputSchema", async () => {
  const tools: ToolInfo[] = [
    {
      serverName: "test",
      toolName: "with_output",
      qualifiedName: "test__with_output",
      description: "Tool with output schema",
      inputSchema: { type: "object" },
      outputSchema: {
        type: "object",
        properties: {
          result: { type: "string" },
        },
      },
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Should parse MCP response format
  assertStringIncludes(module, "await response.json()");
  assertStringIncludes(module, "structuredContent");
  assertStringIncludes(module, "JSON.parse(item.text)");
});

Deno.test("generateToolsModule should handle raw response without outputSchema", async () => {
  const tools: ToolInfo[] = [
    {
      serverName: "test",
      toolName: "no_output",
      qualifiedName: "test__no_output",
      description: "Tool without output schema",
      inputSchema: { type: "object" },
      outputSchema: undefined,
    },
  ];

  const module = await generateToolsModule(tools, "http://localhost:3000");

  // Should return raw response
  assertStringIncludes(module, "return await response.json()");
  // Should not have structured content parsing
  assertEquals(module.includes("structuredContent"), false);
});

Deno.test("TypeCache should cache and retrieve modules", () => {
  const cache = new TypeCache();

  // Initially null
  assertEquals(cache.get(), null);

  // Set and get
  cache.set("test module");
  assertEquals(cache.get(), "test module");

  // Clear
  cache.clear();
  assertEquals(cache.get(), null);
});

Deno.test("TypeCache should overwrite existing cache", () => {
  const cache = new TypeCache();

  cache.set("first module");
  assertEquals(cache.get(), "first module");

  cache.set("second module");
  assertEquals(cache.get(), "second module");
});
