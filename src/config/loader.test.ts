/**
 * Tests for configuration loading.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { emptyConfig, loadConfig } from "./loader.ts";

Deno.test("loadConfig should return null when config file doesn't exist", async () => {
  const config = await loadConfig("/nonexistent/path/.toolscript.json");
  assertEquals(config, null);
});

Deno.test("loadConfig should load valid configuration", async () => {
  // Create temporary config file
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const validConfig = {
    mcpServers: {
      "test-server": {
        type: "stdio",
        command: "node",
        args: ["server.js"],
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(validConfig));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 1);
    const server = config.mcpServers["test-server"];
    assertEquals(server.type, "stdio");
    if (server.type === "stdio") {
      assertEquals(server.command, "node");
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should substitute environment variables", async () => {
  // Set test environment variable
  Deno.env.set("TEST_TOKEN", "secret123");
  Deno.env.set("TEST_URL", "https://example.com");

  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const configWithEnv = {
    mcpServers: {
      "test-server": {
        type: "http",
        url: "${TEST_URL}/api",
        headers: {
          Authorization: "Bearer ${TEST_TOKEN}",
        },
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(configWithEnv));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    const server = config.mcpServers["test-server"];
    if (server.type === "http") {
      assertEquals(server.url, "https://example.com/api");
      assertEquals(server.headers?.Authorization, "Bearer secret123");
    }
  } finally {
    await Deno.remove(tempFile);
    Deno.env.delete("TEST_TOKEN");
    Deno.env.delete("TEST_URL");
  }
});

Deno.test("loadConfig should use default values for missing env vars", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const configWithDefaults = {
    mcpServers: {
      "test-server": {
        type: "http",
        url: "${MISSING_URL:-https://default.com}",
        headers: {
          Authorization: "Bearer ${MISSING_TOKEN:-default_token}",
        },
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(configWithDefaults));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    const server = config.mcpServers["test-server"];
    if (server.type === "http") {
      assertEquals(server.url, "https://default.com");
      assertEquals(server.headers?.Authorization, "Bearer default_token");
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should return empty string for missing env vars without defaults", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const configWithMissing = {
    mcpServers: {
      "test-server": {
        type: "stdio",
        command: "node",
        args: ["server.js"],
        env: {
          MISSING_VAR: "${NONEXISTENT_VAR}",
        },
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(configWithMissing));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    const server = config.mcpServers["test-server"];
    if (server.type === "stdio") {
      assertEquals(server.env?.MISSING_VAR, "");
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should reject invalid JSON", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  await Deno.writeTextFile(tempFile, "{ invalid json }");

  try {
    await assertRejects(
      () => loadConfig(tempFile),
      SyntaxError,
    );
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should reject invalid schema", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const invalidConfig = {
    mcpServers: {
      "test-server": {
        // Missing required 'type' field
        command: "node",
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(invalidConfig));

  try {
    await assertRejects(
      () => loadConfig(tempFile),
    );
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should handle stdio server type", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const stdioConfig = {
    mcpServers: {
      "stdio-server": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "token123",
        },
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(stdioConfig));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    const server = config.mcpServers["stdio-server"];
    assertEquals(server.type, "stdio");
    if (server.type === "stdio") {
      assertEquals(server.command, "npx");
      assertEquals(server.args, ["-y", "@modelcontextprotocol/server-github"]);
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should handle http server type", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const httpConfig = {
    mcpServers: {
      "http-server": {
        type: "http",
        url: "https://api.example.com/mcp",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(httpConfig));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    const server = config.mcpServers["http-server"];
    assertEquals(server.type, "http");
    if (server.type === "http") {
      assertEquals(server.url, "https://api.example.com/mcp");
      assertEquals(server.headers?.["Content-Type"], "application/json");
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should handle sse server type", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  const sseConfig = {
    mcpServers: {
      "sse-server": {
        type: "sse",
        url: "https://api.example.com/sse",
        headers: {
          Authorization: "Bearer token",
        },
      },
    },
  };
  await Deno.writeTextFile(tempFile, JSON.stringify(sseConfig));

  try {
    const config = await loadConfig(tempFile);
    assertExists(config);
    const server = config.mcpServers["sse-server"];
    assertEquals(server.type, "sse");
    if (server.type === "sse") {
      assertEquals(server.url, "https://api.example.com/sse");
    }
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("emptyConfig should return empty configuration", () => {
  const config = emptyConfig();
  assertEquals(Object.keys(config.mcpServers).length, 0);
  assertEquals(config.mcpServers, {});
});
