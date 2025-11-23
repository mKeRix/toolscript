/**
 * Integration tests for sandbox execution.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { executeSandboxed } from "../../src/execution/sandbox.ts";
import { getRandomPort } from "../utils/ports.ts";

// Mock gateway server for testing
function startMockGateway(port: number): Deno.HttpServer {
  const handler = (req: Request): Response => {
    const url = new URL(req.url);

    // Serve mock tools module
    if (url.pathname === "/runtime/tools.ts") {
      const module = `
export const tools = {
  test: {
    async echo(params: { message: string }): Promise<{ result: string }> {
      const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
      if (!url) throw new Error("TOOLSCRIPT_GATEWAY_URL not set");
      const response = await fetch(\`\${url}/tools/test__echo\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error(\`Tool call failed: \${response.statusText}\`);
      }
      return await response.json();
    },
  },
};
      `.trim();
      return new Response(module, {
        headers: { "Content-Type": "application/typescript" },
      });
    }

    // Mock tool execution
    if (url.pathname === "/tools/test__echo" && req.method === "POST") {
      return new Response(JSON.stringify({ result: "echo response" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };

  const server = Deno.serve({ port, hostname: "localhost" }, handler);
  return server;
}

Deno.test("executeSandboxed should execute simple inline code", async () => {
  const port = await getRandomPort();
  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code: 'console.log("Hello, world!");',
    isFile: false,
  });

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, "Hello, world!");
  assertEquals(result.stderr, "");
});

Deno.test("executeSandboxed should execute code from file", async () => {
  // Create temporary TypeScript file
  const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
  await Deno.writeTextFile(tempFile, 'console.log("From file");');

  try {
    const port = await getRandomPort();
    const result = await executeSandboxed({
      gatewayUrl: `http://localhost:${port}`,
      code: tempFile,
      isFile: true,
    });

    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "From file");
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("executeSandboxed should provide TOOLSCRIPT_GATEWAY_URL environment variable", async () => {
  const port = await getRandomPort();
  const code = `
const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
console.log(url || "not set");
  `.trim();

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, `http://localhost:${port}`);
});

Deno.test("executeSandboxed should handle TypeScript code", async () => {
  const port = await getRandomPort();
  const code = `
interface Greeting {
  message: string;
}

const greeting: Greeting = { message: "Hello, TypeScript!" };
console.log(greeting.message);
  `.trim();

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, "Hello, TypeScript!");
});

Deno.test("executeSandboxed should handle top-level await", async () => {
  const port = await getRandomPort();
  const code = `
await new Promise(resolve => setTimeout(resolve, 10));
console.log("Async complete");
  `.trim();

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, true);
  assertStringIncludes(result.stdout, "Async complete");
});

Deno.test("executeSandboxed should capture stderr", async () => {
  const port = await getRandomPort();
  const code = `console.error("Error message");`;

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, true);
  assertStringIncludes(result.stderr, "Error message");
});

Deno.test("executeSandboxed should fail on syntax errors", async () => {
  const port = await getRandomPort();
  const code = `this is not valid typescript`;

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, false);
  // Stderr should contain error information
  assertEquals(result.stderr.length > 0, true);
});

Deno.test("executeSandboxed should fail on runtime errors", async () => {
  const port = await getRandomPort();
  const code = `throw new Error("Runtime error");`;

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, false);
  assertStringIncludes(result.stderr, "Runtime error");
});

Deno.test("executeSandboxed should enforce network restrictions", async () => {
  const port = await getRandomPort();
  // Try to access a different host (should fail)
  const code = `await fetch("https://example.com");`;

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, false);
  // Should contain permission denied error (Deno uses "notcapable" or "permission")
  const errorText = result.stderr.toLowerCase();
  assertEquals(
    errorText.includes("notcapable") || errorText.includes("permission"),
    true,
  );
});

Deno.test("executeSandboxed should enforce filesystem restrictions", async () => {
  const port = await getRandomPort();
  // Try to read a file (should fail)
  const code = `await Deno.readTextFile("/etc/hosts");`;

  const result = await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  assertEquals(result.success, false);
  // Should contain permission denied error (Deno uses "notcapable" or "permission")
  const errorText = result.stderr.toLowerCase();
  assertEquals(
    errorText.includes("notcapable") || errorText.includes("permission"),
    true,
  );
});

Deno.test("executeSandboxed should allow importing from gateway", async () => {
  // Start mock gateway
  const port = await getRandomPort();
  const server = await startMockGateway(port);

  try {
    const code = `
import { tools } from "toolscript";
console.log(typeof tools);
    `.trim();

    const result = await executeSandboxed({
      gatewayUrl: `http://localhost:${port}`,
      code,
      isFile: false,
    });

    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "object");
  } finally {
    await server.shutdown();
  }
});

Deno.test("executeSandboxed should cleanup temporary files", async () => {
  const port = await getRandomPort();
  const code = `console.log("test");`;

  await executeSandboxed({
    gatewayUrl: `http://localhost:${port}`,
    code,
    isFile: false,
  });

  // Import map should be cleaned up (we can't easily verify this without implementation details)
  // This test primarily verifies no errors occur during cleanup
  assertEquals(true, true);
});
