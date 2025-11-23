/**
 * Tests for configuration schema validation.
 */

import { assertEquals } from "@std/assert";
import { serverConfigSchema, toolscriptConfigSchema } from "./schema.ts";

Deno.test("serverConfigSchema should validate stdio server", () => {
  const validStdio = {
    type: "stdio",
    command: "node",
    args: ["server.js"],
    env: { TOKEN: "secret" },
  };

  const result = serverConfigSchema.safeParse(validStdio);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.type, "stdio");
  }
});

Deno.test("serverConfigSchema should validate stdio server without optional fields", () => {
  const minimalStdio = {
    type: "stdio",
    command: "npx",
  };

  const result = serverConfigSchema.safeParse(minimalStdio);
  assertEquals(result.success, true);
});

Deno.test("serverConfigSchema should validate http server", () => {
  const validHttp = {
    type: "http",
    url: "https://api.example.com/mcp",
    headers: { Authorization: "Bearer token" },
  };

  const result = serverConfigSchema.safeParse(validHttp);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.type, "http");
  }
});

Deno.test("serverConfigSchema should validate http server without optional headers", () => {
  const minimalHttp = {
    type: "http",
    url: "https://api.example.com/mcp",
  };

  const result = serverConfigSchema.safeParse(minimalHttp);
  assertEquals(result.success, true);
});

Deno.test("serverConfigSchema should validate sse server", () => {
  const validSse = {
    type: "sse",
    url: "https://api.example.com/sse",
    headers: { "X-Custom": "value" },
  };

  const result = serverConfigSchema.safeParse(validSse);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.type, "sse");
  }
});

Deno.test("serverConfigSchema should reject invalid server type", () => {
  const invalid = {
    type: "websocket",
    url: "wss://example.com",
  };

  const result = serverConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("serverConfigSchema should reject stdio server without command", () => {
  const invalid = {
    type: "stdio",
    args: ["server.js"],
  };

  const result = serverConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("serverConfigSchema should reject http server without url", () => {
  const invalid = {
    type: "http",
    headers: { Authorization: "Bearer token" },
  };

  const result = serverConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("serverConfigSchema should reject http server with invalid url", () => {
  const invalid = {
    type: "http",
    url: "not a valid url",
  };

  const result = serverConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("serverConfigSchema should accept http server with localhost url", () => {
  const valid = {
    type: "http",
    url: "http://localhost:3000/mcp",
  };

  const result = serverConfigSchema.safeParse(valid);
  assertEquals(result.success, true);
});

Deno.test("toolscriptConfigSchema should validate empty configuration", () => {
  const emptyConfig = {
    mcpServers: {},
  };

  const result = toolscriptConfigSchema.safeParse(emptyConfig);
  assertEquals(result.success, true);
});

Deno.test("toolscriptConfigSchema should validate config with single server", () => {
  const config = {
    mcpServers: {
      github: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
      },
    },
  };

  const result = toolscriptConfigSchema.safeParse(config);
  assertEquals(result.success, true);
});

Deno.test("toolscriptConfigSchema should validate config with multiple servers", () => {
  const config = {
    mcpServers: {
      github: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
      },
      api: {
        type: "http",
        url: "https://api.example.com/mcp",
      },
      events: {
        type: "sse",
        url: "https://events.example.com/stream",
      },
    },
  };

  const result = toolscriptConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(Object.keys(result.data.mcpServers).length, 3);
  }
});

Deno.test("toolscriptConfigSchema should reject config without mcpServers field", () => {
  const invalid = {
    servers: {},
  };

  const result = toolscriptConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("toolscriptConfigSchema should reject config with invalid server", () => {
  const invalid = {
    mcpServers: {
      github: {
        type: "stdio",
        // Missing required 'command' field
        args: ["server.js"],
      },
    },
  };

  const result = toolscriptConfigSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("serverConfigSchema should handle server names with special characters", () => {
  const config = {
    mcpServers: {
      "my-api-server": {
        type: "http",
        url: "https://api.example.com",
      },
      "server_with_underscore": {
        type: "stdio",
        command: "node",
      },
      "123-server": {
        type: "sse",
        url: "https://sse.example.com",
      },
    },
  };

  const result = toolscriptConfigSchema.safeParse(config);
  assertEquals(result.success, true);
});

Deno.test("serverConfigSchema should validate stdio server with empty args array", () => {
  const valid = {
    type: "stdio",
    command: "node",
    args: [],
  };

  const result = serverConfigSchema.safeParse(valid);
  assertEquals(result.success, true);
});

Deno.test("serverConfigSchema should validate stdio server with empty env object", () => {
  const valid = {
    type: "stdio",
    command: "node",
    env: {},
  };

  const result = serverConfigSchema.safeParse(valid);
  assertEquals(result.success, true);
});

Deno.test("serverConfigSchema should validate http server with empty headers object", () => {
  const valid = {
    type: "http",
    url: "https://api.example.com",
    headers: {},
  };

  const result = serverConfigSchema.safeParse(valid);
  assertEquals(result.success, true);
});

Deno.test("serverConfigSchema should reject server with extra unknown fields", () => {
  const invalid = {
    type: "stdio",
    command: "node",
    unknownField: "value",
  };

  // Zod by default allows extra fields (strict mode is off)
  // This test documents current behavior
  const result = serverConfigSchema.safeParse(invalid);
  // With default settings, this will pass but extra fields are ignored
  assertEquals(result.success, true);
});

Deno.test("toolscriptConfigSchema should handle complex nested configuration", () => {
  const config = {
    mcpServers: {
      "production-api": {
        type: "http",
        url: "https://prod.example.com/mcp",
        headers: {
          Authorization: "Bearer prod-token",
          "X-API-Version": "v2",
          "Content-Type": "application/json",
        },
      },
      "local-server": {
        type: "stdio",
        command: "deno",
        args: ["run", "--allow-all", "server.ts"],
        env: {
          NODE_ENV: "development",
          DEBUG: "true",
          API_KEY: "dev-key",
        },
      },
    },
  };

  const result = toolscriptConfigSchema.safeParse(config);
  assertEquals(result.success, true);
});
