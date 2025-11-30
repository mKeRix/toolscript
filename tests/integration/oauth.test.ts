/**
 * Integration tests for OAuth2 authentication flow
 * Tests the complete integration between storage, providers, and MCP client
 */

import { assertEquals, assertExists } from "@std/assert";
import { FileOAuthStorage } from "../../src/oauth/storage.ts";
import { createOAuthProvider } from "../../src/oauth/providers/index.ts";
import { startCallbackServer } from "../../src/oauth/callback-server.ts";

Deno.test("OAuth Integration - Authorization Code flow with callback server", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Track authorization state
    let authorizationUrl: URL | undefined;
    const authComplete = Promise.withResolvers<string>();

    // Start callback server
    await using callbackServer = await startCallbackServer({
      onCallback: (result) => {
        if (result.error) {
          authComplete.reject(new Error(`OAuth error: ${result.error}`));
        } else if (result.code) {
          authComplete.resolve(result.code);
        }
      },
    });

    const callbackUrl = `http://localhost:${callbackServer.port}/oauth/callback`;

    // Create OAuth provider
    const provider = createOAuthProvider(
      "test-server",
      storage,
      callbackUrl,
      (url: URL) => {
        authorizationUrl = url;
      },
    );

    // Save client information (simulating dynamic registration)
    await provider.saveClientInformation({
      client_id: "test-client-id",
      client_secret: "test-client-secret",
    });

    // Simulate authorization redirect
    const testAuthUrl = new URL("https://oauth.example.com/authorize");
    testAuthUrl.searchParams.set("client_id", "test-client-id");
    testAuthUrl.searchParams.set("redirect_uri", callbackUrl);
    testAuthUrl.searchParams.set("state", await provider.state());

    await provider.redirectToAuthorization(testAuthUrl);

    // Verify authorization URL was captured
    assertExists(authorizationUrl);
    assertEquals(authorizationUrl.toString(), testAuthUrl.toString());

    // Verify client information was saved
    const savedClient = await provider.clientInformation();
    assertExists(savedClient);
    assertEquals(savedClient.client_id, "test-client-id");

    // Verify callback server is running
    const healthResponse = await fetch(
      `http://localhost:${callbackServer.port}/oauth/callback?code=test-code`,
    );
    assertEquals(healthResponse.ok, true);
    await healthResponse.text();

    // Verify code was received
    const receivedCode = await authComplete.promise;
    assertEquals(receivedCode, "test-code");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("OAuth Integration - Provider persists and loads tokens correctly", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Create first provider instance and save data
    const provider1 = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    await provider1.saveClientInformation({
      client_id: "persistent-client-id",
      client_secret: "persistent-secret",
    });

    await provider1.saveTokens({
      access_token: "persistent-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "persistent-refresh-token",
    });

    // Create second provider instance (simulating app restart)
    const provider2 = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    // Should load previously saved data
    const loadedClient = await provider2.clientInformation();
    const loadedTokens = await provider2.tokens();

    assertExists(loadedClient);
    assertEquals(loadedClient.client_id, "persistent-client-id");

    assertExists(loadedTokens);
    assertEquals(loadedTokens.access_token, "persistent-access-token");
    assertEquals(loadedTokens.refresh_token, "persistent-refresh-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("OAuth Integration - Multiple servers with independent credentials", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Create providers for different servers
    const provider1 = createOAuthProvider(
      "server-1",
      storage,
      "http://localhost:8765/callback",
    );

    const provider2 = createOAuthProvider(
      "server-2",
      storage,
      "http://localhost:8766/callback",
    );

    // Save different credentials for each server
    await provider1.saveClientInformation({
      client_id: "client-1",
    });
    await provider1.saveTokens({
      access_token: "token-1",
      token_type: "Bearer",
      expires_in: 3600,
    });

    await provider2.saveClientInformation({
      client_id: "client-2",
    });
    await provider2.saveTokens({
      access_token: "token-2",
      token_type: "Bearer",
      expires_in: 3600,
    });

    // Verify each server has its own credentials
    const client1 = await provider1.clientInformation();
    const tokens1 = await provider1.tokens();
    const client2 = await provider2.clientInformation();
    const tokens2 = await provider2.tokens();

    assertExists(client1);
    assertExists(tokens1);
    assertExists(client2);
    assertExists(tokens2);

    assertEquals(client1.client_id, "client-1");
    assertEquals(tokens1.access_token, "token-1");
    assertEquals(client2.client_id, "client-2");
    assertEquals(tokens2.access_token, "token-2");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("OAuth Integration - Token update preserves client information", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    // Save client information
    await provider.saveClientInformation({
      client_id: "stable-client-id",
      client_secret: "stable-secret",
    });

    // Save initial tokens
    await provider.saveTokens({
      access_token: "initial-token",
      token_type: "Bearer",
      expires_in: 3600,
    });

    // Update tokens (simulating token refresh)
    await provider.saveTokens({
      access_token: "refreshed-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "new-refresh-token",
    });

    // Client information should still be there
    const client = await provider.clientInformation();
    const tokens = await provider.tokens();

    assertExists(client);
    assertEquals(client.client_id, "stable-client-id");
    assertEquals(client.client_secret, "stable-secret");

    assertExists(tokens);
    assertEquals(tokens.access_token, "refreshed-token");
    assertEquals(tokens.refresh_token, "new-refresh-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("OAuth Integration - Callback server handles error responses", async () => {
  const errorPromise = Promise.withResolvers<string>();

  await using callbackServer = await startCallbackServer({
    onCallback: (result) => {
      if (result.error) {
        errorPromise.resolve(result.error);
      }
    },
  });

  // Simulate OAuth error callback
  const response = await fetch(
    `http://localhost:${callbackServer.port}/oauth/callback?error=access_denied&error_description=User%20denied`,
  );

  assertEquals(response.ok, true);
  await response.text();

  const error = await errorPromise.promise;
  assertEquals(error, "access_denied");
});

Deno.test("OAuth Integration - State parameter generation and consistency", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    // Generate state multiple times
    const state1 = await provider.state();
    const state2 = await provider.state();
    const state3 = await provider.state();

    // State should be consistent across calls
    assertEquals(state1, state2);
    assertEquals(state2, state3);

    // State should be non-empty
    assertEquals(state1.length > 0, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("OAuth Integration - Complete authorization flow simulation", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const authCodePromise = Promise.withResolvers<string>();
    let capturedAuthUrl: URL | undefined;

    // Start callback server
    await using callbackServer = await startCallbackServer({
      onCallback: (result) => {
        if (result.code) {
          authCodePromise.resolve(result.code);
        } else if (result.error) {
          authCodePromise.reject(new Error(result.error));
        }
      },
    });

    const callbackUrl = `http://localhost:${callbackServer.port}/oauth/callback`;

    // Create provider with redirect handler
    const provider = createOAuthProvider(
      "test-server",
      storage,
      callbackUrl,
      (url: URL) => {
        capturedAuthUrl = url;
      },
    );

    // Step 1: Save client information (from config or dynamic registration)
    await provider.saveClientInformation({
      client_id: "flow-test-client",
    });

    // Step 2: Generate state
    const state = await provider.state();

    // Step 3: Build authorization URL
    const authUrl = new URL("https://oauth.example.com/authorize");
    authUrl.searchParams.set("client_id", "flow-test-client");
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    // Step 4: Redirect to authorization (triggers onRedirect callback)
    await provider.redirectToAuthorization(authUrl);

    // Verify authorization URL was captured
    assertExists(capturedAuthUrl);
    assertEquals(capturedAuthUrl.searchParams.get("client_id"), "flow-test-client");
    assertEquals(capturedAuthUrl.searchParams.get("state"), state);

    // Step 5: Simulate OAuth provider redirecting back with code
    const callbackResponse = await fetch(
      `${callbackUrl}?code=authorization-code-123&state=${state}`,
    );
    assertEquals(callbackResponse.ok, true);
    await callbackResponse.text();

    // Step 6: Verify code was received
    const receivedCode = await authCodePromise.promise;
    assertEquals(receivedCode, "authorization-code-123");

    // Step 7: Simulate token exchange (would happen via MCP SDK)
    await provider.saveTokens({
      access_token: "final-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "final-refresh-token",
    });

    // Verify complete OAuth data is stored
    const finalClient = await provider.clientInformation();
    const finalTokens = await provider.tokens();

    assertExists(finalClient);
    assertEquals(finalClient.client_id, "flow-test-client");

    assertExists(finalTokens);
    assertEquals(finalTokens.access_token, "final-access-token");
    assertEquals(finalTokens.refresh_token, "final-refresh-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
