/**
 * Tests for OAuth callback server
 */

import { assertEquals, assertExists } from "@std/assert";
import { startCallbackServer } from "./callback-server.ts";

Deno.test("startCallbackServer - starts on random available port", async () => {
  await using server = await startCallbackServer({
    onCallback: (_result) => {
      // Just testing server startup
    },
  });

  assertExists(server.port);
  assertEquals(server.port > 0, true, "Port should be a positive number");
});

Deno.test("startCallbackServer - handles successful OAuth callback with code", async () => {
  const resultPromise = Promise.withResolvers<{ code?: string; error?: string }>();

  await using server = await startCallbackServer({
    onCallback: (result) => {
      resultPromise.resolve(result);
    },
  });

  // Simulate OAuth callback with code
  const response = await fetch(
    `http://localhost:${server.port}/oauth/callback?code=test-code-123&state=test-state`,
  );

  assertEquals(response.ok, true);
  assertEquals(response.headers.get("content-type"), "text/html");

  const html = await response.text();
  assertEquals(html.includes("Authentication Successful"), true);

  const result = await resultPromise.promise;
  assertEquals(result.code, "test-code-123");
  assertEquals(result.error, undefined);
});

Deno.test("startCallbackServer - handles OAuth callback with error", async () => {
  const resultPromise = Promise.withResolvers<{ code?: string; error?: string }>();

  await using server = await startCallbackServer({
    onCallback: (result) => {
      resultPromise.resolve(result);
    },
  });

  // Simulate OAuth callback with error
  const response = await fetch(
    `http://localhost:${server.port}/oauth/callback?error=access_denied&error_description=User%20denied`,
  );

  assertEquals(response.ok, true);
  const html = await response.text();
  assertEquals(html.includes("Authentication Failed"), true);

  const result = await resultPromise.promise;
  assertEquals(result.error, "access_denied");
  assertEquals(result.code, undefined);
});

Deno.test("startCallbackServer - returns 400 for callback without code or error", async () => {
  let callbackCalled = false;

  await using server = await startCallbackServer({
    onCallback: () => {
      callbackCalled = true;
    },
  });

  // Callback without code or error
  const response = await fetch(`http://localhost:${server.port}/oauth/callback`);

  assertEquals(response.status, 400);
  const html = await response.text();
  assertEquals(html.includes("No authorization code"), true);

  // Callback should not have been invoked
  assertEquals(callbackCalled, false);
});

Deno.test("startCallbackServer - returns 404 for non-callback paths", async () => {
  await using server = await startCallbackServer({
    onCallback: () => {},
  });

  const response = await fetch(`http://localhost:${server.port}/other-path`);

  assertEquals(response.status, 404);
  await response.text(); // Consume body to prevent leak
});

Deno.test("startCallbackServer - cleans up with cleanup() method", async () => {
  const server = await startCallbackServer({
    onCallback: () => {},
  });

  const port = server.port;

  // Server should be running
  const response1 = await fetch(`http://localhost:${port}/oauth/callback?code=test`);
  assertEquals(response1.ok, true);
  await response1.text(); // Consume body to prevent leak

  // Cleanup
  await server.cleanup();

  // Server should be stopped
  try {
    await fetch(`http://localhost:${port}/oauth/callback?code=test`, {
      signal: AbortSignal.timeout(1000),
    });
    throw new Error("Expected fetch to fail");
  } catch (error) {
    // Expected - connection should be refused
    assertEquals(error instanceof Error, true);
  }
});

Deno.test("startCallbackServer - cleans up with await using syntax", async () => {
  let serverPort: number;

  {
    await using server = await startCallbackServer({
      onCallback: () => {},
    });

    serverPort = server.port;

    // Server should be running
    const response = await fetch(`http://localhost:${serverPort}/oauth/callback?code=test`);
    assertEquals(response.ok, true);
    await response.text(); // Consume body to prevent leak
  }

  // After leaving scope, server should be stopped
  try {
    await fetch(`http://localhost:${serverPort}/oauth/callback?code=test`, {
      signal: AbortSignal.timeout(1000),
    });
    throw new Error("Expected fetch to fail");
  } catch (error) {
    // Expected - connection should be refused
    assertEquals(error instanceof Error, true);
  }
});

Deno.test("startCallbackServer - handles multiple requests", async () => {
  const results: Array<{ code?: string; error?: string }> = [];

  await using server = await startCallbackServer({
    onCallback: (result) => {
      results.push(result);
    },
  });

  // Make multiple requests
  const response1 = await fetch(
    `http://localhost:${server.port}/oauth/callback?code=code1`,
  );
  assertEquals(response1.ok, true);
  await response1.text(); // Consume body to prevent leak

  const response2 = await fetch(
    `http://localhost:${server.port}/oauth/callback?error=denied`,
  );
  assertEquals(response2.ok, true);
  await response2.text(); // Consume body to prevent leak

  const response3 = await fetch(
    `http://localhost:${server.port}/oauth/callback?code=code3`,
  );
  assertEquals(response3.ok, true);
  await response3.text(); // Consume body to prevent leak

  // All callbacks should have been invoked
  assertEquals(results.length, 3);
  assertEquals(results[0].code, "code1");
  assertEquals(results[1].error, "denied");
  assertEquals(results[2].code, "code3");
});

Deno.test("startCallbackServer - handles concurrent requests", async () => {
  const results: Array<{ code?: string; error?: string }> = [];

  await using server = await startCallbackServer({
    onCallback: (result) => {
      results.push(result);
    },
  });

  // Make concurrent requests
  const [response1, response2, response3] = await Promise.all([
    fetch(`http://localhost:${server.port}/oauth/callback?code=code1`),
    fetch(`http://localhost:${server.port}/oauth/callback?code=code2`),
    fetch(`http://localhost:${server.port}/oauth/callback?code=code3`),
  ]);

  assertEquals(response1.ok, true);
  assertEquals(response2.ok, true);
  assertEquals(response3.ok, true);

  // Consume bodies to prevent leaks
  await Promise.all([
    response1.text(),
    response2.text(),
    response3.text(),
  ]);

  // All callbacks should have been invoked
  assertEquals(results.length, 3);

  // Results might be in any order due to concurrency
  const codes = results.map((r) => r.code).sort();
  assertEquals(codes, ["code1", "code2", "code3"]);
});

Deno.test("startCallbackServer - success page includes auto-close script", async () => {
  await using server = await startCallbackServer({
    onCallback: () => {},
  });

  const response = await fetch(
    `http://localhost:${server.port}/oauth/callback?code=test-code`,
  );

  const html = await response.text();

  // Should include script to auto-close window
  assertEquals(html.includes("<script>"), true);
  assertEquals(html.includes("window.close()"), true);
});

Deno.test("startCallbackServer - preserves state parameter", async () => {
  await using server = await startCallbackServer({
    onCallback: () => {},
  });

  // State parameter should be passed through but not affect behavior
  const response = await fetch(
    `http://localhost:${server.port}/oauth/callback?code=test-code&state=random-state-value`,
  );

  assertEquals(response.ok, true);
  const html = await response.text();
  assertEquals(html.includes("Authentication Successful"), true);
});

Deno.test("startCallbackServer - preserves error_description parameter", async () => {
  await using server = await startCallbackServer({
    onCallback: () => {},
  });

  const response = await fetch(
    `http://localhost:${server.port}/oauth/callback?error=access_denied&error_description=User%20clicked%20cancel`,
  );

  assertEquals(response.ok, true);
  const html = await response.text();
  assertEquals(html.includes("Authentication Failed"), true);
});
