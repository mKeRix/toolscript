/**
 * OAuth authentication command
 * Implements standalone OAuth2 authentication flow for MCP servers
 */

import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { deadline } from "@std/async/deadline";
import { loadConfig } from "../../config/loader.ts";
import { createOAuthStorage } from "../../oauth/storage.ts";
import { openBrowser } from "../../oauth/browser.ts";
import { getLogger } from "@logtape/logtape";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startCallbackServer } from "../../oauth/callback-server.ts";
import { connectToServer, createTransport } from "../../gateway/mcp-utils.ts";
import type { ServerConfig } from "../../config/types.ts";
import { createOAuthProvider } from "../../oauth/providers/index.ts";

const logger = getLogger(["toolscript", "cli", "auth"]);

/**
 * OAuth authentication status for a server
 */
interface OAuthServerStatus {
  name: string;
  authenticated: boolean;
}

/**
 * List all OAuth2-configured servers with their authentication status
 */
async function listOAuthServers(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);

  if (!config) {
    console.error("Error: Configuration file not found.");
    Deno.exit(1);
  }

  const storage = createOAuthStorage();
  const statuses: OAuthServerStatus[] = [];

  // Check each server
  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    if (!["sse", "http"].includes(serverConfig.type)) {
      continue; // Skip servers without OAuth support
    }

    const oauthData = await storage.getOAuthData(name);
    const authenticated = !!(oauthData?.tokens);

    statuses.push({ name, authenticated });
  }

  if (statuses.length === 0) {
    console.log("No HTTP or SSE servers found in configuration");
    console.log("OAuth2 authentication is automatically detected from HTTP/SSE servers.");
    console.log("Add a server to get started:");
    console.log('  "my-server": { "type": "http", "url": "https://example.com/mcp" }');
    return;
  }

  const rows = statuses.map((s) => [
    s.authenticated ? "✓" : "✗",
    s.name,
    s.authenticated ? "authenticated" : "not authenticated",
  ]);

  const table = new Table()
    .header(["Status", "Server", "Authentication"])
    .body(rows)
    .border(true);

  table.render();

  console.log("\nRun 'toolscript auth <server-name>' to authenticate a server.");
}

/**
 * Check if server is already authenticated
 * @returns true if already authenticated, false if needs OAuth flow
 */
async function checkExistingAuth(
  serverName: string,
  serverConfig: ServerConfig,
  callbackUrl: string,
  authProvider: OAuthClientProvider,
): Promise<boolean> {
  try {
    await using _connection = await connectToServer({
      serverName,
      serverConfig,
      redirectUrl: callbackUrl,
      authProvider,
      timeoutMs: 30000,
    });
    return true;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      logger.debug`Received UnauthorizedError - OAuth flow needed`;
      return false;
    }
    // Re-throw non-auth errors
    throw error;
  }
}

/**
 * Perform OAuth authorization flow with user interaction
 * @returns Authorization code from callback
 */
async function performOAuthFlow(
  authorizationUrl: URL | null,
  authComplete: Promise<string>,
): Promise<string> {
  if (!authorizationUrl) {
    throw new Error("Authorization URL not provided by server");
  }

  console.log(`Authorization URL: ${authorizationUrl.href}`);
  console.log("Opening browser for authorization...");

  const opened = await openBrowser(authorizationUrl);

  if (!opened) {
    console.log("Failed to open browser automatically.");
    console.log("Please open the URL above in your browser to continue.");
  }

  console.log("Waiting for authorization...");
  const authCode = await deadline(authComplete, 5 * 60 * 1000); // 5 minutes
  console.log("✓ Authorization code received!");

  return authCode;
}

/**
 * Complete authentication by exchanging code for tokens
 */
async function finishAuthentication(
  serverName: string,
  serverConfig: ServerConfig,
  authCode: string,
  authProvider: OAuthClientProvider,
): Promise<void> {
  console.log("Exchanging authorization code for access token...");

  // Create transport directly (without connecting client) to finish auth
  const transport = createTransport({
    serverName,
    serverConfig,
    authProvider,
  });

  try {
    // Finish auth with the authorization code - this exchanges code for tokens
    // and saves them via the authProvider
    if (
      transport instanceof SSEClientTransport ||
      transport instanceof StreamableHTTPClientTransport
    ) {
      await transport.finishAuth(authCode);
    } else {
      throw new Error(`Unexpected transport type for ${serverConfig.type} server`);
    }

    console.log("✓ Authentication successful! Credentials stored securely.");
  } finally {
    // Clean up transport without connecting client
    try {
      await transport.close();
    } catch (error) {
      logger.error`Error closing transport: ${error}`;
    }
  }
}

/**
 * Perform OAuth authentication for a specific server
 */
export async function authenticateServer(serverName: string, configPath?: string): Promise<void> {
  logger.info`Starting authentication for ${serverName}`;
  const config = await loadConfig(configPath);

  if (!config) {
    console.error("Error: Configuration not found.");
    Deno.exit(1);
  }

  const serverConfig = config.mcpServers[serverName];
  if (!serverConfig) {
    console.error(`Error: Server '${serverName}' not found in configuration.`);
    Deno.exit(1);
  }

  if (!["http", "sse"].includes(serverConfig.type)) {
    console.error(
      `Error: Server '${serverName}' is a ${serverConfig.type} server. OAuth2 is only supported for HTTP/SSE servers.`,
    );
    Deno.exit(1);
  }

  console.log(`Starting OAuth authentication for '${serverName}'...`);
  // Track authorization state
  let authorizationUrl: URL | null = null;
  const authComplete = Promise.withResolvers<string>();

  // Start temporary callback server on random port
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
  logger.debug`Callback server started on port ${callbackServer.port}`;

  const storage = createOAuthStorage();
  const authProvider = createOAuthProvider(
    serverName,
    storage,
    callbackUrl,
    (url: URL) => {
      authorizationUrl = url;
    },
  );

  try {
    const isAuthenticated = await checkExistingAuth(
      serverName,
      serverConfig,
      callbackUrl,
      authProvider,
    );

    if (isAuthenticated) {
      console.log("✓ Already authenticated or no authentication required!");
      return;
    }

    const authCode = await performOAuthFlow(authorizationUrl, authComplete.promise);
    await finishAuthentication(serverName, serverConfig, authCode, authProvider);
  } catch (error) {
    logger.error`Authentication failed: ${error}`;
    console.error(`Error: Authentication failed`);
    if (error instanceof Error) {
      console.error(error.message);
    }

    Deno.exit(1);
  }
}

/**
 * Auth command definition
 */
export const authCommand = new Command()
  .name("auth")
  .description("Authenticate with OAuth2-protected MCP servers")
  .arguments("[server-name:string]")
  .option("--config <path:string>", "Path to configuration file")
  .action(async (options, serverName?: string) => {
    if (!serverName) {
      await listOAuthServers(options.config);
    } else {
      await authenticateServer(serverName, options.config);
    }
  });
