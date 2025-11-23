/**
 * Tests for custom error types.
 */

import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  ConfigError,
  ExecutionError,
  GatewayError,
  ToolscriptError,
  TypeGenerationError,
} from "./errors.ts";

Deno.test("ToolscriptError should be an Error instance", () => {
  const error = new ToolscriptError("test message");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, ToolscriptError);
  assertEquals(error.message, "test message");
  assertEquals(error.name, "ToolscriptError");
});

Deno.test("ConfigError should extend ToolscriptError", () => {
  const error = new ConfigError("config error message");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, ToolscriptError);
  assertInstanceOf(error, ConfigError);
  assertEquals(error.message, "config error message");
  assertEquals(error.name, "ConfigError");
});

Deno.test("GatewayError should extend ToolscriptError", () => {
  const error = new GatewayError("gateway error message");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, ToolscriptError);
  assertInstanceOf(error, GatewayError);
  assertEquals(error.message, "gateway error message");
  assertEquals(error.name, "GatewayError");
});

Deno.test("ExecutionError should extend ToolscriptError", () => {
  const error = new ExecutionError("execution error message");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, ToolscriptError);
  assertInstanceOf(error, ExecutionError);
  assertEquals(error.message, "execution error message");
  assertEquals(error.name, "ExecutionError");
});

Deno.test("TypeGenerationError should extend ToolscriptError", () => {
  const error = new TypeGenerationError("type generation error message");
  assertInstanceOf(error, Error);
  assertInstanceOf(error, ToolscriptError);
  assertInstanceOf(error, TypeGenerationError);
  assertEquals(error.message, "type generation error message");
  assertEquals(error.name, "TypeGenerationError");
});

Deno.test("errors should have stack traces", () => {
  const error = new ToolscriptError("test");
  assertEquals(typeof error.stack, "string");
});

Deno.test("errors should be throwable and catchable", () => {
  let caught = false;
  try {
    throw new ConfigError("test error");
  } catch (error) {
    caught = true;
    assertInstanceOf(error, ConfigError);
    assertEquals(error.message, "test error");
  }
  assertEquals(caught, true);
});

Deno.test("errors can be caught as ToolscriptError base class", () => {
  const errors = [
    new ConfigError("config"),
    new GatewayError("gateway"),
    new ExecutionError("execution"),
    new TypeGenerationError("type generation"),
  ];

  for (const error of errors) {
    assertInstanceOf(error, ToolscriptError);
  }
});
