#!/usr/bin/env -S deno run --allow-all
/**
 * OAuth2-protected HTTP MCP server for E2E testing.
 * Implements OAuth discovery and token validation.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";

// Get port from command line args
const port = parseInt(Deno.args[0] || "0");
if (port === 0) {
  console.error("Error: Port must be specified as first argument");
  Deno.exit(1);
}

// In-memory storage for OAuth state
const authCodes = new Map<string, { clientId: string; codeVerifier?: string }>();
const accessTokens = new Map<string, { clientId: string; expiresAt: number }>();

// Test OAuth configuration
const TEST_CLIENT_ID = "test-client-id";
const TEST_CLIENT_SECRET = "test-client-secret";

// Create MCP server instance
const mcpServer = new McpServer({
  name: "oauth-test-server",
  version: "1.0.0",
});

// Register a simple tool
mcpServer.tool(
  "protected_echo",
  "Echo a message (requires OAuth)",
  {
    message: z.string().describe("Message to echo"),
  },
  ({ message }) => {
    return {
      content: [
        {
          type: "text",
          text: `Protected echo: ${message}`,
        },
      ],
    };
  },
);

// Create Hono app
const app = new Hono();

// Protected Resource Metadata (RFC9728) - MCP server advertises its authorization server
const protectedResourceMetadataHandler = (c: Context) => {
  const baseUrl = `http://localhost:${port}`;
  return c.json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ["read", "write"],
  });
};

// OAuth Authorization Server Metadata (RFC8414)
const authorizationServerMetadataHandler = (c: Context) => {
  const baseUrl = `http://localhost:${port}`;
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    scopes_supported: ["read", "write"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    code_challenge_methods_supported: ["S256"],
  });
};

// Protected Resource Metadata endpoints (per MCP spec)
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadataHandler);
app.get("/mcp/.well-known/oauth-protected-resource", protectedResourceMetadataHandler);

// Authorization Server Metadata endpoints (per OAuth 2.0 spec)
app.get("/.well-known/oauth-authorization-server", authorizationServerMetadataHandler);

// Dynamic client registration endpoint
app.post("/oauth/register", (c) => {
  // For testing, we accept any registration and return a fixed client
  return c.json({
    client_id: TEST_CLIENT_ID,
    client_secret: TEST_CLIENT_SECRET,
    registration_access_token: "test-registration-token",
    registration_client_uri: `http://localhost:${port}/oauth/register/${TEST_CLIENT_ID}`,
  });
});

// Authorization endpoint
app.get("/oauth/authorize", (c) => {
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri");
  const state = c.req.query("state");
  const codeChallenge = c.req.query("code_challenge");

  if (!clientId || !redirectUri || !state) {
    return c.text("Missing required parameters", 400);
  }

  // Generate authorization code
  const code = crypto.randomUUID();
  authCodes.set(code, {
    clientId: clientId,
    codeVerifier: codeChallenge, // Store for PKCE validation
  });

  // For testing, automatically redirect with the code
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", state);

  return c.redirect(callbackUrl.toString());
});

// Token endpoint
app.post("/oauth/token", async (c) => {
  const body = await c.req.json();

  if (body.grant_type === "authorization_code") {
    const code = body.code;
    const codeData = authCodes.get(code);

    if (!codeData) {
      return c.json({ error: "invalid_grant" }, 400);
    }

    // Clean up used code
    authCodes.delete(code);

    // Generate access token
    const accessToken = crypto.randomUUID();
    const expiresIn = 3600; // 1 hour
    accessTokens.set(accessToken, {
      clientId: codeData.clientId,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return c.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
    });
  } else if (body.grant_type === "client_credentials") {
    // Validate client credentials
    if (body.client_id !== TEST_CLIENT_ID || body.client_secret !== TEST_CLIENT_SECRET) {
      return c.json({ error: "invalid_client" }, 401);
    }

    // Generate access token
    const accessToken = crypto.randomUUID();
    const expiresIn = 3600; // 1 hour
    accessTokens.set(accessToken, {
      clientId: body.client_id,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return c.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
    });
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// Middleware to validate OAuth token
app.use("/mcp/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Return 401 with WWW-Authenticate header per MCP OAuth spec
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="http://localhost:${port}/.well-known/oauth-protected-resource", scope="read write"`,
    );
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header" },
      401,
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  const tokenData = accessTokens.get(token);

  if (!tokenData) {
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="http://localhost:${port}/.well-known/oauth-protected-resource", scope="read write"`,
    );
    return c.json({ error: "unauthorized", message: "Invalid access token" }, 401);
  }

  if (Date.now() > tokenData.expiresAt) {
    accessTokens.delete(token);
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="http://localhost:${port}/.well-known/oauth-protected-resource", scope="read write"`,
    );
    return c.json({ error: "unauthorized", message: "Access token expired" }, 401);
  }

  await next();
});

// Setup MCP transport
const transport = new StreamableHTTPTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

// Connect the MCP server to the transport
await mcpServer.connect(transport);

// Setup MCP endpoint (protected by OAuth middleware)
app.all("/mcp", (c) => transport.handleRequest(c));

console.log(`OAuth-protected MCP server starting on http://localhost:${port}`);

// Store server reference for clean shutdown
const server = Deno.serve({ port, hostname: "localhost" }, app.fetch);

// Handle shutdown signals
const shutdown = async () => {
  console.log("OAuth MCP server shutting down...");
  await server.shutdown();
  Deno.exit(0);
};

Deno.addSignalListener("SIGTERM", shutdown);
Deno.addSignalListener("SIGINT", shutdown);
