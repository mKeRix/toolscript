/**
 * Tests for tool filtering utilities.
 */

import { assertEquals } from "@std/assert";
import { shouldIncludeTool, type ToolFilters } from "./tool-filter.ts";

Deno.test("shouldIncludeTool should include all tools when no filters", () => {
  const filters: ToolFilters = {};

  assertEquals(shouldIncludeTool("any_tool", filters), true);
  assertEquals(shouldIncludeTool("another_tool", filters), true);
  assertEquals(shouldIncludeTool("delete_something", filters), true);
});

Deno.test("shouldIncludeTool should match exact tool names in includeTools", () => {
  const filters: ToolFilters = {
    includeTools: ["create_issue", "list_repos"],
  };

  assertEquals(shouldIncludeTool("create_issue", filters), true);
  assertEquals(shouldIncludeTool("list_repos", filters), true);
  assertEquals(shouldIncludeTool("delete_repo", filters), false);
  assertEquals(shouldIncludeTool("get_issue", filters), false);
});

Deno.test("shouldIncludeTool should match multiple exact tool names in includeTools", () => {
  const filters: ToolFilters = {
    includeTools: ["get_issue", "get_repo", "list_repos"],
  };

  assertEquals(shouldIncludeTool("get_issue", filters), true);
  assertEquals(shouldIncludeTool("get_repo", filters), true);
  assertEquals(shouldIncludeTool("list_repos", filters), true);
  assertEquals(shouldIncludeTool("create_issue", filters), false);
  assertEquals(shouldIncludeTool("delete_repo", filters), false);
});

Deno.test("shouldIncludeTool should exclude exact tool names in excludeTools", () => {
  const filters: ToolFilters = {
    excludeTools: ["delete_repo", "remove_file"],
  };

  assertEquals(shouldIncludeTool("get_issue", filters), true);
  assertEquals(shouldIncludeTool("create_issue", filters), true);
  assertEquals(shouldIncludeTool("delete_repo", filters), false);
  assertEquals(shouldIncludeTool("remove_file", filters), false);
});

Deno.test("shouldIncludeTool should exclude multiple exact tool names in excludeTools", () => {
  const filters: ToolFilters = {
    excludeTools: ["delete_repo", "delete_issue", "remove_file"],
  };

  assertEquals(shouldIncludeTool("get_issue", filters), true);
  assertEquals(shouldIncludeTool("create_issue", filters), true);
  assertEquals(shouldIncludeTool("delete_repo", filters), false);
  assertEquals(shouldIncludeTool("delete_issue", filters), false);
  assertEquals(shouldIncludeTool("remove_file", filters), false);
});

Deno.test("shouldIncludeTool should apply both include and exclude filters", () => {
  const filters: ToolFilters = {
    includeTools: ["get_issue", "create_issue", "create_repo", "delete_issue"],
    excludeTools: ["delete_issue"],
  };

  // In include list, not excluded
  assertEquals(shouldIncludeTool("get_issue", filters), true);
  assertEquals(shouldIncludeTool("create_issue", filters), true);
  assertEquals(shouldIncludeTool("create_repo", filters), true);

  // In include list but also excluded (exclude wins)
  assertEquals(shouldIncludeTool("delete_issue", filters), false);

  // Not in include list
  assertEquals(shouldIncludeTool("list_users", filters), false);
  assertEquals(shouldIncludeTool("get_user", filters), false);
});

Deno.test("shouldIncludeTool should work with include filters", () => {
  const filters: ToolFilters = {
    includeTools: ["get_user", "get_public_data"],
    excludeTools: ["get_private_key"],
  };

  assertEquals(shouldIncludeTool("get_user", filters), true);
  assertEquals(shouldIncludeTool("get_public_data", filters), true);
  assertEquals(shouldIncludeTool("get_private_key", filters), false);
  assertEquals(shouldIncludeTool("create_user", filters), false);
});

Deno.test("shouldIncludeTool should work with exclude filters", () => {
  const filters: ToolFilters = {
    excludeTools: ["delete_dangerous", "get_internal"],
  };

  assertEquals(shouldIncludeTool("get_user", filters), true);
  assertEquals(shouldIncludeTool("create_user", filters), true);
  assertEquals(shouldIncludeTool("delete_dangerous", filters), false);
  assertEquals(shouldIncludeTool("get_internal", filters), false);
});

Deno.test("shouldIncludeTool should handle empty includeTools array", () => {
  const filters: ToolFilters = {
    includeTools: [],
  };

  // Empty includeTools means include all (same as not specifying it)
  assertEquals(shouldIncludeTool("any_tool", filters), true);
});

Deno.test("shouldIncludeTool should handle empty excludeTools array", () => {
  const filters: ToolFilters = {
    excludeTools: [],
  };

  // Empty excludeTools means exclude none (same as not specifying it)
  assertEquals(shouldIncludeTool("any_tool", filters), true);
});

Deno.test("shouldIncludeTool should work with empty ToolFilters", () => {
  const filters: ToolFilters = {};

  assertEquals(shouldIncludeTool("any_tool", filters), true);
  assertEquals(shouldIncludeTool("another_tool", filters), true);
});
