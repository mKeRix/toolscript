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
      Error,
      "Failed to load config",
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

// Multi-config tests
Deno.test("loadConfig should parse comma-separated config paths", async () => {
  // Create two temporary config files
  const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
  const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });

  const config1 = {
    mcpServers: {
      "server1": {
        type: "stdio",
        command: "node",
        args: ["server1.js"],
      },
    },
  };

  const config2 = {
    mcpServers: {
      "server2": {
        type: "stdio",
        command: "node",
        args: ["server2.js"],
      },
    },
  };

  await Deno.writeTextFile(tempFile1, JSON.stringify(config1));
  await Deno.writeTextFile(tempFile2, JSON.stringify(config2));

  try {
    const config = await loadConfig(`${tempFile1},${tempFile2}`);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 2);
    assertExists(config.mcpServers["server1"]);
    assertExists(config.mcpServers["server2"]);
  } finally {
    await Deno.remove(tempFile1);
    await Deno.remove(tempFile2);
  }
});

Deno.test("loadConfig should handle array of config paths", async () => {
  const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
  const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });

  const config1 = {
    mcpServers: {
      "server1": {
        type: "stdio",
        command: "node",
        args: ["server1.js"],
      },
    },
  };

  const config2 = {
    mcpServers: {
      "server2": {
        type: "stdio",
        command: "node",
        args: ["server2.js"],
      },
    },
  };

  await Deno.writeTextFile(tempFile1, JSON.stringify(config1));
  await Deno.writeTextFile(tempFile2, JSON.stringify(config2));

  try {
    const config = await loadConfig([tempFile1, tempFile2]);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 2);
    assertExists(config.mcpServers["server1"]);
    assertExists(config.mcpServers["server2"]);
  } finally {
    await Deno.remove(tempFile1);
    await Deno.remove(tempFile2);
  }
});

Deno.test("loadConfig should merge configs with later overriding earlier", async () => {
  const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
  const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });

  const config1 = {
    mcpServers: {
      "shared-server": {
        type: "stdio",
        command: "node",
        args: ["server1.js"],
      },
      "server1": {
        type: "stdio",
        command: "node",
        args: ["unique1.js"],
      },
    },
  };

  const config2 = {
    mcpServers: {
      "shared-server": {
        type: "http",
        url: "https://example.com/api",
      },
      "server2": {
        type: "stdio",
        command: "node",
        args: ["unique2.js"],
      },
    },
  };

  await Deno.writeTextFile(tempFile1, JSON.stringify(config1));
  await Deno.writeTextFile(tempFile2, JSON.stringify(config2));

  try {
    const config = await loadConfig(`${tempFile1},${tempFile2}`);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 3);

    // Later config should override
    const sharedServer = config.mcpServers["shared-server"];
    assertEquals(sharedServer.type, "http");
    if (sharedServer.type === "http") {
      assertEquals(sharedServer.url, "https://example.com/api");
    }

    // Unique servers from both configs should exist
    assertExists(config.mcpServers["server1"]);
    assertExists(config.mcpServers["server2"]);
  } finally {
    await Deno.remove(tempFile1);
    await Deno.remove(tempFile2);
  }
});

Deno.test("loadConfig should skip missing files in multi-config", async () => {
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
    const config = await loadConfig(`/nonexistent/file.json,${tempFile}`);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 1);
    assertExists(config.mcpServers["test-server"]);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should return null when all configs are missing", async () => {
  const config = await loadConfig("/nonexistent/file1.json,/nonexistent/file2.json");
  assertEquals(config, null);
});

Deno.test("loadConfig should expand tilde in config paths", async () => {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!homeDir) {
    // Skip test if HOME is not set
    return;
  }

  const tempFile = await Deno.makeTempFile({ suffix: ".json", dir: homeDir });
  const fileName = tempFile.split("/").pop() || tempFile.split("\\").pop();
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
    const config = await loadConfig(`~/${fileName}`);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 1);
    assertExists(config.mcpServers["test-server"]);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("loadConfig should trim whitespace from comma-separated paths", async () => {
  const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
  const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });

  const config1 = {
    mcpServers: {
      "server1": {
        type: "stdio",
        command: "node",
        args: ["server1.js"],
      },
    },
  };

  const config2 = {
    mcpServers: {
      "server2": {
        type: "stdio",
        command: "node",
        args: ["server2.js"],
      },
    },
  };

  await Deno.writeTextFile(tempFile1, JSON.stringify(config1));
  await Deno.writeTextFile(tempFile2, JSON.stringify(config2));

  try {
    // Test with spaces around commas
    const config = await loadConfig(`${tempFile1} , ${tempFile2}`);
    assertExists(config);
    assertEquals(Object.keys(config.mcpServers).length, 2);
    assertExists(config.mcpServers["server1"]);
    assertExists(config.mcpServers["server2"]);
  } finally {
    await Deno.remove(tempFile1);
    await Deno.remove(tempFile2);
  }
});

Deno.test("loadConfig should throw on invalid JSON in second config", async () => {
  const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
  const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });

  const validConfig = {
    mcpServers: {
      "server1": {
        type: "stdio",
        command: "node",
        args: ["server1.js"],
      },
    },
  };

  await Deno.writeTextFile(tempFile1, JSON.stringify(validConfig));
  await Deno.writeTextFile(tempFile2, "{ invalid json }");

  try {
    await assertRejects(
      () => loadConfig(`${tempFile1},${tempFile2}`),
      Error,
      "Failed to load config",
    );
  } finally {
    await Deno.remove(tempFile1);
    await Deno.remove(tempFile2);
  }
});

Deno.test("loadConfig should preserve environment variable substitution in merged configs", async () => {
  Deno.env.set("TEST_TOKEN_1", "token1");
  Deno.env.set("TEST_TOKEN_2", "token2");

  const tempFile1 = await Deno.makeTempFile({ suffix: ".json" });
  const tempFile2 = await Deno.makeTempFile({ suffix: ".json" });

  const config1 = {
    mcpServers: {
      "server1": {
        type: "http",
        url: "https://example1.com",
        headers: {
          Authorization: "Bearer ${TEST_TOKEN_1}",
        },
      },
    },
  };

  const config2 = {
    mcpServers: {
      "server2": {
        type: "http",
        url: "https://example2.com",
        headers: {
          Authorization: "Bearer ${TEST_TOKEN_2}",
        },
      },
    },
  };

  await Deno.writeTextFile(tempFile1, JSON.stringify(config1));
  await Deno.writeTextFile(tempFile2, JSON.stringify(config2));

  try {
    const config = await loadConfig(`${tempFile1},${tempFile2}`);
    assertExists(config);

    const server1 = config.mcpServers["server1"];
    const server2 = config.mcpServers["server2"];

    if (server1.type === "http") {
      assertEquals(server1.headers?.Authorization, "Bearer token1");
    }

    if (server2.type === "http") {
      assertEquals(server2.headers?.Authorization, "Bearer token2");
    }
  } finally {
    await Deno.remove(tempFile1);
    await Deno.remove(tempFile2);
    Deno.env.delete("TEST_TOKEN_1");
    Deno.env.delete("TEST_TOKEN_2");
  }
});
