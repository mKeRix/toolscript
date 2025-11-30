/**
 * End-to-end tests for CLI commands.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { getRandomPort } from "../utils/ports.ts";
import { startOAuthServer, startTestGateway } from "../utils/test-gateway.ts";

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
Deno.test({
  name: "Gateway integration tests",
  sanitizeResources: false, // OAuth server processes and subprocess streams are managed manually
  fn: async (t) => {
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

    // OAuth2-specific tests
    await t.step("CLI auth should list OAuth servers with status", async () => {
      await using oauthServer = await startOAuthServer();

      const result = await runCli(["auth", "--config", oauthServer.configFile]);

      assertEquals(result.success, true);
      assertStringIncludes(result.stdout, "Status");
      assertStringIncludes(result.stdout, "Server");
      assertStringIncludes(result.stdout, "Authentication");
      assertStringIncludes(result.stdout, "oauth-auth-code");
      assertStringIncludes(result.stdout, "not authenticated");
      assertStringIncludes(result.stdout, "Run 'toolscript auth <server-name>' to authenticate");
    });

    await t.step("CLI auth should reject stdio servers", async () => {
      const result = await runCli(["auth", "stdio-test-server", "--config", gateway.configFile]);

      assertEquals(result.success, false);
      assertStringIncludes(result.stderr, "stdio server");
      assertStringIncludes(result.stderr, "OAuth2 is only supported for HTTP/SSE");
    });

    await t.step(
      "OAuth Authorization Code flow - complete auth flow, store credentials, gateway uses them",
      async () => {
        await using oauthServer = await startOAuthServer();
        const gatewayPort = await getRandomPort();

        // Create a temp HOME directory for this test
        const tempHomeDir = await Deno.makeTempDir();

        try {
          // Step 1: Simulate OAuth Authorization Code flow to get credentials
          const discoveryResponse = await fetch(
            `http://localhost:${oauthServer.port}/.well-known/oauth-authorization-server`,
          );
          const discovery = await discoveryResponse.json();

          // Dynamic client registration
          const registerResponse = await fetch(discovery.registration_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_name: "toolscript-test",
              redirect_uris: ["http://localhost:8765/oauth/callback"],
            }),
          });
          const clientData = await registerResponse.json();

          // Get authorization code (simulating user authorization)
          const authUrl = new URL(discovery.authorization_endpoint);
          authUrl.searchParams.set("client_id", clientData.client_id);
          authUrl.searchParams.set("redirect_uri", "http://localhost:8765/oauth/callback");
          authUrl.searchParams.set("state", "test-state");
          authUrl.searchParams.set("response_type", "code");

          const authResponse = await fetch(authUrl.toString(), { redirect: "manual" });
          const redirectLocation = authResponse.headers.get("location");
          const redirectUrl = new URL(redirectLocation!);
          const authCode = redirectUrl.searchParams.get("code")!;

          // Exchange code for tokens
          const tokenResponse = await fetch(discovery.token_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "authorization_code",
              code: authCode,
              client_id: clientData.client_id,
            }),
          });
          const tokenData = await tokenResponse.json();

          // Step 2: Store OAuth data in the location where gateway will look for it
          // We need to store it in tempHomeDir/.toolscript/oauth/
          const { FileOAuthStorage } = await import("../../src/oauth/storage.ts");
          const oauthStorageDir = `${tempHomeDir}/.toolscript/oauth`;
          const storage = new FileOAuthStorage(oauthStorageDir);

          await storage.saveOAuthData("oauth-auth-code", {
            clientInformation: {
              client_id: clientData.client_id,
              client_secret: clientData.client_secret,
            },
            tokens: {
              access_token: tokenData.access_token,
              token_type: tokenData.token_type,
              expires_in: tokenData.expires_in,
            },
          });

          // Step 3: Start gateway with OAuth server configured
          // Gateway should use the stored credentials
          const gatewayConfigFile = await Deno.makeTempFile({ suffix: ".json" });
          const gatewayConfig = {
            mcpServers: {
              "oauth-auth-code": {
                type: "http",
                url: `http://localhost:${oauthServer.port}/mcp`,
                oauth: {
                  clientId: "test-client-id", // Authorization code flow (no secret)
                },
              },
            },
          };
          await Deno.writeTextFile(gatewayConfigFile, JSON.stringify(gatewayConfig, null, 2));

          const gatewayCmd = new Deno.Command("deno", {
            args: [
              "run",
              "--allow-net",
              "--allow-read",
              "--allow-write",
              "--allow-env",
              "--allow-run",
              "--allow-sys",
              "src/cli/main.ts",
              "gateway",
              "start",
              "--port",
              `${gatewayPort}`,
              "--config",
              gatewayConfigFile,
            ],
            stdout: "piped",
            stderr: "piped",
            env: {
              HOME: tempHomeDir, // Point to our temp HOME with OAuth storage
            },
          });

          const gatewayProcess = gatewayCmd.spawn();

          try {
            // Wait for gateway to be ready
            let gatewayReady = false;
            for (let i = 0; i < 30; i++) {
              try {
                const healthResponse = await fetch(`http://localhost:${gatewayPort}/health`, {
                  signal: AbortSignal.timeout(1000),
                });
                if (healthResponse.ok) {
                  gatewayReady = true;
                  break;
                }
              } catch {
                // Not ready yet
              }
              await new Promise((resolve) => setTimeout(resolve, 200));
            }

            assertEquals(gatewayReady, true, "Gateway should start with stored OAuth credentials");

            // Verify gateway can list tools from OAuth server
            const listToolsResult = await runCli([
              "list-tools",
              "oauth-auth-code",
              "--gateway-url",
              `http://localhost:${gatewayPort}`,
            ]);

            if (!listToolsResult.success) {
              console.error("List tools failed. Stdout:", listToolsResult.stdout);
              console.error("Stderr:", listToolsResult.stderr);
            }

            assertEquals(
              listToolsResult.success,
              true,
              "Gateway should list tools from OAuth server",
            );
            assertStringIncludes(listToolsResult.stdout, "protected_echo");

            // Step 4: Call a tool through the gateway - it should use stored credentials
            const code = `
import { tools } from "toolscript";
const result = await tools.oauthAuthCode.protectedEcho({ message: "auth code via gateway" });
console.log(JSON.stringify(result));
        `.trim();

            const result = await runCli([
              "exec",
              code,
              "--gateway-url",
              `http://localhost:${gatewayPort}`,
            ]);

            // Should successfully call the protected tool using stored credentials
            if (!result.success) {
              console.error("Tool call failed. Stdout:", result.stdout);
              console.error("Stderr:", result.stderr);
            }
            assertEquals(
              result.success,
              true,
              "Should execute tool using stored OAuth credentials",
            );
            assertStringIncludes(result.stdout, "Protected echo: auth code via gateway");
          } finally {
            gatewayProcess.kill("SIGTERM");
            await gatewayProcess.status;
            await Deno.remove(gatewayConfigFile);
          }
        } finally {
          await Deno.remove(tempHomeDir, { recursive: true });
        }
      },
    );

    await t.step(
      "OAuth - protected endpoint should reject requests without valid token",
      async () => {
        await using oauthServer = await startOAuthServer();

        // Try to call a protected tool without authentication
        const mcpResponse = await fetch(`http://localhost:${oauthServer.port}/mcp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // No Authorization header
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
              name: "protected_echo",
              arguments: { message: "unauthorized test" },
            },
            id: 1,
          }),
        });

        // Should be rejected with 401 Unauthorized
        assertEquals(mcpResponse.status, 401, "Should reject request without auth token");

        const errorData = await mcpResponse.json();
        assertStringIncludes(JSON.stringify(errorData), "unauthorized");
      },
    );
  },
});

Deno.test({
  name: "CLI exec should execute inline code without gateway",
  sanitizeResources: false,
  fn: async () => {
    const result = await runCli(["exec", 'console.log("Hello from exec")']);

    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "Hello from exec");
  },
});

Deno.test({
  name: "CLI exec should execute code from file without gateway",
  sanitizeResources: false,
  fn: async () => {
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
  },
});

Deno.test({
  name: "CLI should handle unknown commands",
  sanitizeResources: false,
  fn: async () => {
    const result = await runCli(["unknown-command"]);

    assertEquals(result.success, false);
    // Should show error or help
    assertEquals(result.stderr.length > 0 || result.stdout.length > 0, true);
  },
});

Deno.test({
  name: "CLI should handle invalid gateway URL gracefully",
  sanitizeResources: false,
  fn: async () => {
    const result = await runCli(["list-servers", "--gateway-url", "http://invalid:99999"]);

    assertEquals(result.success, false);
    // Should have error about connection failure
    assertEquals(result.stderr.length > 0, true);
  },
});
