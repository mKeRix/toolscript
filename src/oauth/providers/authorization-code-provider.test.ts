/**
 * Tests for Authorization Code OAuth provider
 */

import { assertEquals, assertExists } from "@std/assert";
import { AuthorizationCodeProvider } from "./authorization-code-provider.ts";
import { FileOAuthStorage } from "../storage.ts";
import type { OAuthData } from "../types.ts";
import type { OAuthClientInformation, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

Deno.test("AuthorizationCodeProvider - generates state parameter", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const state1 = await provider.state();
    const state2 = await provider.state();

    // State should be generated once and reused
    assertExists(state1);
    assertEquals(state1.length > 0, true);
    assertEquals(state1, state2, "State should be consistent across calls");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - returns undefined when no client information stored", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const clientInfo = await provider.clientInformation();
    assertEquals(clientInfo, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - saves and loads client information", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const clientInfo: OAuthClientInformation = {
      client_id: "test-client-id",
      client_secret: "test-secret",
    };

    // Save client information
    await provider.saveClientInformation(clientInfo);

    // Load it back
    const loaded = await provider.clientInformation();
    assertExists(loaded);
    assertEquals(loaded.client_id, "test-client-id");
    assertEquals(loaded.client_secret, "test-secret");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - returns undefined when no tokens stored", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const tokens = await provider.tokens();
    assertEquals(tokens, undefined);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - saves and loads tokens", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const testTokens: OAuthTokens = {
      access_token: "test-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "test-refresh-token",
    };

    // Save tokens
    await provider.saveTokens(testTokens);

    // Load them back
    const loaded = await provider.tokens();
    assertExists(loaded);
    assertEquals(loaded.access_token, "test-access-token");
    assertEquals(loaded.token_type, "Bearer");
    assertEquals(loaded.refresh_token, "test-refresh-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - saves tokens and client info together", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const clientInfo: OAuthClientInformation = {
      client_id: "test-client-id",
      client_secret: "test-secret",
    };

    const testTokens: OAuthTokens = {
      access_token: "test-access-token",
      token_type: "Bearer",
      expires_in: 3600,
    };

    // Save client info first
    await provider.saveClientInformation(clientInfo);

    // Then save tokens
    await provider.saveTokens(testTokens);

    // Both should be present
    const loadedClient = await provider.clientInformation();
    const loadedTokens = await provider.tokens();

    assertExists(loadedClient);
    assertEquals(loadedClient.client_id, "test-client-id");

    assertExists(loadedTokens);
    assertEquals(loadedTokens.access_token, "test-access-token");

    // Verify in storage directly
    const data = await storage.getOAuthData("test-server");
    assertExists(data);
    assertExists(data.clientInformation);
    assertExists(data.tokens);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - updates tokens without losing client info", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const clientInfo: OAuthClientInformation = {
      client_id: "test-client-id",
      client_secret: "test-secret",
    };

    await provider.saveClientInformation(clientInfo);

    // Save initial tokens
    const initialTokens: OAuthTokens = {
      access_token: "initial-token",
      token_type: "Bearer",
      expires_in: 3600,
    };
    await provider.saveTokens(initialTokens);

    // Update tokens (simulating refresh)
    const updatedTokens: OAuthTokens = {
      access_token: "refreshed-token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "new-refresh-token",
    };
    await provider.saveTokens(updatedTokens);

    // Client info should still be there
    const loadedClient = await provider.clientInformation();
    assertExists(loadedClient);
    assertEquals(loadedClient.client_id, "test-client-id");

    // Tokens should be updated
    const loadedTokens = await provider.tokens();
    assertExists(loadedTokens);
    assertEquals(loadedTokens.access_token, "refreshed-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - redirectToAuthorization calls onRedirect callback", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    let redirectCalled = false;
    let capturedUrl: URL | undefined;

    const onRedirect = (url: URL) => {
      redirectCalled = true;
      capturedUrl = url;
    };

    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
      onRedirect,
    );

    const authUrl = new URL("https://oauth.example.com/authorize?client_id=test");
    await provider.redirectToAuthorization(authUrl);

    assertEquals(redirectCalled, true);
    assertExists(capturedUrl);
    assertEquals(capturedUrl!.toString(), authUrl.toString());
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - redirectToAuthorization works without callback", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const authUrl = new URL("https://oauth.example.com/authorize?client_id=test");

    // Should not throw without onRedirect callback
    await provider.redirectToAuthorization(authUrl);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - saves and retrieves code verifier", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const testVerifier = "test-code-verifier-12345";

    await provider.saveCodeVerifier(testVerifier);
    const retrieved = provider.codeVerifier();

    assertEquals(retrieved, testVerifier);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - throws when retrieving code verifier before saving", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    // Should throw error when no verifier has been saved
    try {
      provider.codeVerifier();
      throw new Error("Should have thrown");
    } catch (error) {
      assertEquals(error instanceof Error, true);
      assertEquals((error as Error).message.includes("No code verifier"), true);
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - returns correct client metadata", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const redirectUrl = "http://localhost:8765/callback";
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      redirectUrl,
    );

    const metadata = provider.clientMetadata;

    assertExists(metadata);
    assertEquals(metadata.redirect_uris, [redirectUrl]);
    assertEquals(metadata.token_endpoint_auth_method, "none");
    assertEquals(metadata.grant_types, ["authorization_code", "refresh_token"]);
    assertEquals(metadata.response_types, ["code"]);
    assertEquals(metadata.client_name, "Toolscript");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - handles URL redirect URL", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const redirectUrl = new URL("http://localhost:8765/callback");
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      redirectUrl,
    );

    assertEquals(provider.redirectUrl, redirectUrl);

    const metadata = provider.clientMetadata;
    assertEquals(metadata.redirect_uris, [redirectUrl.toString()]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - loads existing data on creation", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    // Pre-populate storage
    const existingData: OAuthData = {
      clientInformation: {
        client_id: "existing-client-id",
        client_secret: "existing-secret",
      },
      tokens: {
        access_token: "existing-token",
        token_type: "Bearer",
        expires_in: 3600,
      },
    };

    await storage.saveOAuthData("test-server", existingData);

    // Create provider - it should load existing data
    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const loadedClient = await provider.clientInformation();
    const loadedTokens = await provider.tokens();

    assertExists(loadedClient);
    assertEquals(loadedClient.client_id, "existing-client-id");

    assertExists(loadedTokens);
    assertEquals(loadedTokens.access_token, "existing-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("AuthorizationCodeProvider - async onRedirect callback works", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    let redirectCalled = false;

    const onRedirect = async (_url: URL) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      redirectCalled = true;
    };

    const provider = new AuthorizationCodeProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
      onRedirect,
    );

    const authUrl = new URL("https://oauth.example.com/authorize");
    await provider.redirectToAuthorization(authUrl);

    assertEquals(redirectCalled, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
