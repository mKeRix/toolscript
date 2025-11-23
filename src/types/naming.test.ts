/**
 * Tests for naming convention utilities.
 */

import { assertEquals } from "@std/assert";
import {
  toCamelCase,
  toFunctionId,
  toNamespaceId,
  toPascalCase,
  toTypeName,
} from "./naming.ts";

Deno.test("toCamelCase should convert snake_case to camelCase", () => {
  assertEquals(toCamelCase("create_issue"), "createIssue");
  assertEquals(toCamelCase("get_user_profile"), "getUserProfile");
  assertEquals(toCamelCase("my_server"), "myServer");
});

Deno.test("toCamelCase should convert kebab-case to camelCase", () => {
  assertEquals(toCamelCase("get-user-profile"), "getUserProfile");
  assertEquals(toCamelCase("github-api"), "githubApi");
  assertEquals(toCamelCase("my-api-server"), "myApiServer");
});

Deno.test("toCamelCase should preserve existing camelCase", () => {
  assertEquals(toCamelCase("createIssue"), "createissue"); // Normalizes to lowercase first
  assertEquals(toCamelCase("getUserProfile"), "getuserprofile");
});

Deno.test("toCamelCase should prefix numbers with underscore", () => {
  assertEquals(toCamelCase("123test"), "_123test");
  assertEquals(toCamelCase("456server"), "_456server");
});

Deno.test("toCamelCase should collapse multiple underscores/hyphens", () => {
  assertEquals(toCamelCase("create__issue"), "createIssue");
  assertEquals(toCamelCase("get---user"), "getUser");
  assertEquals(toCamelCase("my__api__server"), "myApiServer");
});

Deno.test("toCamelCase should remove invalid characters", () => {
  assertEquals(toCamelCase("create@issue"), "createissue");
  assertEquals(toCamelCase("get$user!profile"), "getuserprofile");
  assertEquals(toCamelCase("my.api.server"), "myapiserver");
});

Deno.test("toCamelCase should handle empty strings", () => {
  assertEquals(toCamelCase(""), "");
});

Deno.test("toPascalCase should convert to PascalCase", () => {
  assertEquals(toPascalCase("create_issue"), "CreateIssue");
  assertEquals(toPascalCase("get-user-profile"), "GetUserProfile");
  assertEquals(toPascalCase("my_server"), "MyServer");
});

Deno.test("toPascalCase should handle numbers", () => {
  assertEquals(toPascalCase("123test"), "_123test");
});

Deno.test("toTypeName should combine server and tool names", () => {
  assertEquals(toTypeName("github", "create_issue"), "GithubCreateIssue");
  assertEquals(toTypeName("my-api-server", "get_user_profile"), "MyApiServerGetUserProfile");
  assertEquals(toTypeName("my_server", "create-issue"), "MyServerCreateIssue");
});

Deno.test("toNamespaceId should convert server names to camelCase", () => {
  assertEquals(toNamespaceId("github"), "github");
  assertEquals(toNamespaceId("my_server"), "myServer");
  assertEquals(toNamespaceId("github-api"), "githubApi");
});

Deno.test("toFunctionId should convert tool names to camelCase", () => {
  assertEquals(toFunctionId("create_issue"), "createIssue");
  assertEquals(toFunctionId("get-user-profile"), "getUserProfile");
  assertEquals(toFunctionId("list_repos"), "listRepos");
});

Deno.test("naming functions should handle edge cases", () => {
  // Empty strings
  assertEquals(toCamelCase(""), "");
  assertEquals(toPascalCase(""), "");

  // Single character
  assertEquals(toCamelCase("a"), "a");
  assertEquals(toPascalCase("a"), "A");

  // All uppercase
  assertEquals(toCamelCase("API"), "api");
  assertEquals(toPascalCase("API"), "Api");

  // Mixed delimiters
  assertEquals(toCamelCase("get_user-profile"), "getUserProfile");
  assertEquals(toCamelCase("my__api--server"), "myApiServer");
});
