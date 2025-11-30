/**
 * Tests for OAuth provider factory
 */

import { assertEquals, assertExists } from "@std/assert";
import { createOAuthProvider } from "./index.ts";
import { FileOAuthStorage } from "../storage.ts";
import { AuthorizationCodeProvider } from "./authorization-code-provider.ts";

Deno.test("createOAuthProvider - creates Authorization Code provider with string redirectUrl", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    assertEquals(provider instanceof AuthorizationCodeProvider, true);
    assertEquals(provider.redirectUrl, "http://localhost:8765/callback");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createOAuthProvider - creates Authorization Code provider with URL redirectUrl", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const redirectUrl = new URL("http://localhost:8765/callback");
    const provider = createOAuthProvider(
      "test-server",
      storage,
      redirectUrl,
    );

    assertEquals(provider instanceof AuthorizationCodeProvider, true);
    assertEquals(provider.redirectUrl, redirectUrl);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createOAuthProvider - creates provider with onRedirect callback", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    let redirectCalled = false;
    const onRedirect = (_url: URL) => {
      redirectCalled = true;
    };

    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
      onRedirect,
    );

    assertEquals(provider instanceof AuthorizationCodeProvider, true);

    // Test that onRedirect is wired up correctly
    await provider.redirectToAuthorization(new URL("https://oauth.example.com/authorize"));
    assertEquals(redirectCalled, true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createOAuthProvider - creates provider without onRedirect callback", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    assertEquals(provider instanceof AuthorizationCodeProvider, true);

    // Should work without onRedirect
    await provider.redirectToAuthorization(new URL("https://oauth.example.com/authorize"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createOAuthProvider - provider has correct client metadata", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    const metadata = provider.clientMetadata;

    assertExists(metadata);
    assertEquals(metadata.redirect_uris, ["http://localhost:8765/callback"]);
    assertEquals(metadata.grant_types, ["authorization_code", "refresh_token"]);
    assertEquals(metadata.response_types, ["code"]);
    assertEquals(metadata.client_name, "Toolscript");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createOAuthProvider - provider can save and load tokens", async () => {
  const tempDir = await Deno.makeTempDir();
  const storage = new FileOAuthStorage(tempDir);

  try {
    const provider = createOAuthProvider(
      "test-server",
      storage,
      "http://localhost:8765/callback",
    );

    // Save tokens
    await provider.saveTokens({
      access_token: "test-token",
      token_type: "Bearer",
      expires_in: 3600,
    });

    // Load tokens
    const tokens = await provider.tokens();
    assertExists(tokens);
    assertEquals(tokens.access_token, "test-token");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
