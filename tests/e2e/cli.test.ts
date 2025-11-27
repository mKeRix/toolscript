/**
 * End-to-end tests for CLI commands.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { getRandomPort } from "../utils/ports.ts";
import { startTestGateway } from "../utils/test-gateway.ts";

// Helper to run CLI commands
async function runCli(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  success: boolean;
}> {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-run",
      "--allow-sys",
      "src/cli/main.ts",
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const process = cmd.spawn();
  const output = await process.output();

  return {
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
    success: output.success,
  };
}

Deno.test("CLI should display version", async () => {
  const result = await runCli(["--version"]);

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, "0.1.0");
});

Deno.test("CLI should display help", async () => {
  const result = await runCli(["--help"]);

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, "toolscript");
  assertStringIncludes(result.stdout, "MCP code mode");
});

Deno.test("CLI list-servers should require running gateway", async () => {
  const port = await getRandomPort();
  const result = await runCli(["list-servers", "--gateway-url", `http://localhost:${port}`]);

  // Should fail because gateway is not running
  assertEquals(result.success, false);
});

// Tests that use a shared gateway instance
Deno.test("Gateway integration tests", async (t) => {
  await using gateway = await startTestGateway();

  await t.step("Gateway should support stdio transport", async () => {
    const result = await runCli(["list-servers", "--gateway-url", gateway.url]);

    // Should succeed and list the stdio test server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "stdio-test-server");
  });

  await t.step("CLI get-types should work with running gateway", async () => {
    const result = await runCli([
      "get-types",
      "--filter",
      "stdio-test-server",
      "--gateway-url",
      gateway.url,
    ]);

    // Should succeed and return TypeScript types for the stdio server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "echo");
    assertStringIncludes(result.stdout, "add");
    assertStringIncludes(result.stdout, "get_current_time");
  });

  await t.step("Gateway should list tools on stdio server", async () => {
    const result = await runCli([
      "list-tools",
      "stdio-test-server",
      "--gateway-url",
      gateway.url,
    ]);

    // Should succeed and list the tools from the stdio server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "echo");
    assertStringIncludes(result.stdout, "add");
    assertStringIncludes(result.stdout, "get_current_time");
  });

  await t.step("CLI exec should call stdio server tool", async () => {
    const code = `
import { tools } from "toolscript";
const result = await tools.stdioTestServer.add({ a: 5, b: 3 });
console.log(JSON.stringify(result));
    `.trim();

    const result = await runCli(["exec", code, "--gateway-url", gateway.url]);

    // Should succeed and show the addition result
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "5 + 3 = 8");
  });

  await t.step("CLI should respect TOOLSCRIPT_GATEWAY_URL env var", async () => {
    // Test that list-servers works with env var instead of flag
    const cmd = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-net",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "--allow-run",
        "--allow-sys",
        "src/cli/main.ts",
        "list-servers",
      ],
      stdout: "piped",
      stderr: "piped",
      env: {
        TOOLSCRIPT_GATEWAY_URL: gateway.url,
      },
    });

    const process = cmd.spawn();
    const output = await process.output();

    const stdout = new TextDecoder().decode(output.stdout);

    // Should succeed and list all servers
    assertEquals(output.success, true);
    assertStringIncludes(stdout, "stdio-test-server");
  });

  await t.step("Gateway should support HTTP transport", async () => {
    const result = await runCli([
      "list-servers",
      "--gateway-url",
      gateway.url,
    ]);

    // Should list the HTTP test server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "http-test-server");
  });

  await t.step("Gateway should list tools on HTTP server", async () => {
    const result = await runCli([
      "list-tools",
      "http-test-server",
      "--gateway-url",
      gateway.url,
    ]);

    // Should list tools from HTTP server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "greet");
    assertStringIncludes(result.stdout, "multiply");
  });

  await t.step("Gateway should support SSE transport", async () => {
    const result = await runCli([
      "list-servers",
      "--gateway-url",
      gateway.url,
    ]);

    // Should list the SSE test server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "sse-test-server");
  });

  await t.step("Gateway should list tools on SSE server", async () => {
    const result = await runCli([
      "list-tools",
      "sse-test-server",
      "--gateway-url",
      gateway.url,
    ]);

    // Should list tools from SSE server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "reverse");
    assertStringIncludes(result.stdout, "uppercase");
  });

  await t.step("CLI exec should call HTTP server tool", async () => {
    const code = `
import { tools } from "toolscript";
const result = await tools.httpTestServer.greet({ name: "Alice" });
console.log(JSON.stringify(result));
    `.trim();

    const result = await runCli(["exec", code, "--gateway-url", gateway.url]);

    // Should succeed and show the greeting from HTTP server
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "Hello, Alice!");
    assertStringIncludes(result.stdout, "from HTTP server");
  });

  await t.step("CLI exec should call SSE server tool", async () => {
    const code = `
import { tools } from "toolscript";
const result = await tools.sseTestServer.uppercase({ text: "world" });
console.log(JSON.stringify(result));
    `.trim();

    const result = await runCli(["exec", code, "--gateway-url", gateway.url]);

    // Should succeed and show the uppercase string
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "Uppercase: WORLD");
  });

  await t.step("CLI exec should call tools from multiple servers in one script", async () => {
    const code = `
import { tools } from "toolscript";

// Call stdio transport
const echoResult = await tools.stdioTestServer.echo({ message: "test" });
console.log("stdio:", JSON.stringify(echoResult));

// Call HTTP transport
const greetResult = await tools.httpTestServer.greet({ name: "Bob" });
console.log("http:", JSON.stringify(greetResult));

// Call SSE transport
const reverseResult = await tools.sseTestServer.reverse({ text: "abc" });
console.log("sse:", JSON.stringify(reverseResult));
    `.trim();

    const result = await runCli(["exec", code, "--gateway-url", gateway.url]);

    // Should succeed and show results from all three transports
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "stdio:");
    assertStringIncludes(result.stdout, "Echo: test");
    assertStringIncludes(result.stdout, "http:");
    assertStringIncludes(result.stdout, "Hello, Bob!");
    assertStringIncludes(result.stdout, "sse:");
    assertStringIncludes(result.stdout, "Reversed: cba");
  });

  await t.step("CLI exec should execute code from file", async () => {
    // Create temporary toolscript file
    const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
    await Deno.writeTextFile(tempFile, 'console.log("Hello from file");');

    try {
      const result = await runCli(["exec", "--file", tempFile, "--gateway-url", gateway.url]);

      assertEquals(result.success, true);
      assertStringIncludes(result.stdout, "Hello from file");
    } finally {
      await Deno.remove(tempFile);
    }
  });

  await t.step("CLI exec should handle syntax errors with gateway", async () => {
    const result = await runCli(["exec", "this is invalid code", "--gateway-url", gateway.url]);

    assertEquals(result.success, false);
    // Should have error output about syntax, not connection
    assertEquals(result.stderr.length > 0, true);
  });

  await t.step("CLI list-tools should require server name", async () => {
    const result = await runCli(["list-tools", "--gateway-url", gateway.url]);

    assertEquals(result.success, false);
    // Should indicate missing required argument, not connection error
    assertStringIncludes(result.stderr.toLowerCase() + result.stdout.toLowerCase(), "server");
  });

  await t.step("CLI search should find tools with exact keyword match", async () => {
    const result = await runCli([
      "search",
      "echo",
      "--gateway-url",
      gateway.url,
      "--limit",
      "1",
    ]);

    // Should succeed and return matching tools
    assertEquals(result.success, true);
    // Should find the echo tool with exact keyword match
    assertStringIncludes(result.stdout.toLowerCase(), "echo");
  });

  await t.step("CLI search should find tools with fuzzy match", async () => {
    const result = await runCli([
      "search",
      "greet someone",
      "--gateway-url",
      gateway.url,
      "--limit",
      "1",
    ]);

    // Should succeed and return matching tools
    assertEquals(result.success, true);
    // Should find greet tool through fuzzy/semantic matching
    assertStringIncludes(result.stdout.toLowerCase(), "greet");
  });

  await t.step("CLI search should find tools with semantic match", async () => {
    const result = await runCli([
      "search",
      "flip text backwards",
      "--gateway-url",
      gateway.url,
      "--limit",
      "1",
    ]);

    // Should succeed and return matching tools using semantic understanding
    assertEquals(result.success, true);
    // Should find reverse tool based on semantic meaning (query uses "flip backwards", not "reverse")
    assertStringIncludes(result.stdout.toLowerCase(), "reverse");
  });

  await t.step("CLI search stats endpoint should return search statistics", async () => {
    // Fetch search stats from gateway
    const response = await fetch(`${gateway.url}/search/stats`);

    assertEquals(response.ok, true);
    const stats = await response.json();

    // Verify stats structure
    assertEquals(typeof stats.toolsIndexed, "number");
    assertEquals(typeof stats.semanticAvailable, "boolean");
    assertEquals(typeof stats.model, "string");
    assertEquals(typeof stats.cacheHitRate, "number");
    assertEquals(stats.toolsIndexed > 0, true, "Should have indexed some tools");
    assertEquals(stats.semanticAvailable, true, "Semantic search must be available");
    assertEquals(stats.model.length > 0, true, "Should have a model name");

    console.log(`Search stats: ${stats.toolsIndexed} tools indexed, model=${stats.model}`);
  });

  await t.step("CLI search should support types output format", async () => {
    const result = await runCli([
      "search",
      "add",
      "--gateway-url",
      gateway.url,
      "--output",
      "types",
    ]);

    // Should succeed and return TypeScript types
    assertEquals(result.success, true);
    // Should include confidence table
    assertStringIncludes(result.stdout, "Confidence");
    // Should include TypeScript code
    assertStringIncludes(result.stdout, "```typescript");
    // Should find the add tool
    assertStringIncludes(result.stdout.toLowerCase(), "add");
  });

  await t.step("CLI search should handle no results gracefully", async () => {
    const result = await runCli([
      "search",
      "nonexistent_tool_xyz_12345_quantum_flux_capacitor",
      "--gateway-url",
      gateway.url,
    ]);

    // Should succeed but indicate no results
    assertEquals(result.success, true);
    assertStringIncludes(result.stdout.toLowerCase(), "no tools found");
  });

  await t.step("CLI search with types output should use camelCase in example code", async () => {
    const result = await runCli([
      "search",
      "add numbers",
      "--gateway-url",
      gateway.url,
      "--output",
      "types",
    ]);

    // Should succeed
    assertEquals(result.success, true);

    // The server name "stdio-test-server" should be converted to camelCase "stdioTestServer"
    // in the usage example
    assertStringIncludes(result.stdout, "tools.stdioTestServer");

    // Should NOT use the raw kebab-case server name in the example
    assertEquals(
      result.stdout.includes("tools.stdio-test-server"),
      false,
      "Example should use camelCase server names, not kebab-case",
    );
  });

  await t.step("CLI get-types should use camelCase in example code", async () => {
    const result = await runCli([
      "get-types",
      "--filter",
      "stdio-test-server",
      "--gateway-url",
      gateway.url,
    ]);

    // Should succeed
    assertEquals(result.success, true);

    // The server name "stdio-test-server" should be converted to camelCase "stdioTestServer"
    // in the usage example
    assertStringIncludes(result.stdout, "tools.stdioTestServer");

    // Should NOT use the raw kebab-case server name in the example
    assertEquals(
      result.stdout.includes("tools.stdio-test-server"),
      false,
      "Example should use camelCase server names, not kebab-case",
    );
  });
});

Deno.test("CLI exec should execute inline code without gateway", async () => {
  const result = await runCli(["exec", 'console.log("Hello from exec")']);

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, "Hello from exec");
});

Deno.test("CLI exec should execute code from file without gateway", async () => {
  // Create temporary toolscript file
  const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
  await Deno.writeTextFile(tempFile, 'console.log("Hello from file");');

  try {
    const result = await runCli(["exec", "--file", tempFile]);

    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "Hello from file");
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("CLI should handle unknown commands", async () => {
  const result = await runCli(["unknown-command"]);

  assertEquals(result.success, false);
  // Should show error or help
  assertEquals(result.stderr.length > 0 || result.stdout.length > 0, true);
});

Deno.test("CLI should handle invalid gateway URL gracefully", async () => {
  const result = await runCli(["list-servers", "--gateway-url", "http://invalid:99999"]);

  assertEquals(result.success, false);
  // Should have error about connection failure
  assertEquals(result.stderr.length > 0, true);
});
