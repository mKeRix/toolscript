/**
 * Common MCP client utilities
 * Shared code for creating and managing MCP client connections
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { deadline } from "@std/async/deadline";
import type { ServerConfig } from "../config/types.ts";
import { getLogger } from "../utils/logger.ts";
import { createOAuthStorage } from "../oauth/storage.ts";
import { createOAuthProvider } from "../oauth/providers/index.ts";
import packageInfo from "../../deno.json" with { type: "json" };

const logger = getLogger("mcp-utils");

/**
 * MCP transport type
 */
export type McpTransport =
  | StdioClientTransport
  | StreamableHTTPClientTransport
  | SSEClientTransport;

/**
 * Configuration for creating MCP transport
 */
export interface TransportConfig {
  serverName: string;
  serverConfig: ServerConfig;
  redirectUrl?: string;
  onRedirect?: (url: URL) => void | Promise<void>;
}

/**
 * Creates a HTTP-based transport.
 *
 * @param config - Transport configuration
 * @returns MCP transport instance
 */
function createHTTPTransport(config: TransportConfig): McpTransport {
  const { serverName, serverConfig, redirectUrl, onRedirect } = config;

  // Type guard: this function is only called for HTTP/SSE servers
  if (serverConfig.type !== "http" && serverConfig.type !== "sse") {
    throw new Error(`${serverConfig.type} is not a HTTP server type`);
  }

  const url = new URL(serverConfig.url);
  const requestInit: Record<string, unknown> = {};

  if (serverConfig.headers) {
    requestInit.headers = serverConfig.headers;
  }

  logger.debug(`Setting up OAuth2 provider for ${serverName}`);

  const storage = createOAuthStorage();
  const effectiveRedirectUrl = redirectUrl || "";
  const authProvider = createOAuthProvider(
    serverName,
    storage,
    effectiveRedirectUrl,
    onRedirect,
  );

  switch (serverConfig.type) {
    case "sse":
      return new SSEClientTransport(url, {
        requestInit: requestInit as never,
        authProvider,
      });
    case "http":
      return new StreamableHTTPClientTransport(url, {
        requestInit: requestInit as never,
        authProvider,
      });
  }
}

/**
 * Create MCP transport based on server configuration
 *
 * @param config - Transport configuration
 * @returns MCP transport instance
 */
export function createTransport(config: TransportConfig): McpTransport {
  const { serverConfig } = config;

  switch (serverConfig.type) {
    case "stdio": {
      const env = serverConfig.env || {};
      return new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: { ...Deno.env.toObject(), ...env },
      });
    }
    case "http":
    case "sse": {
      return createHTTPTransport(config);
    }
  }

  throw new Error(`Unsupported server type`);
}

/**
 * Options for connecting to MCP server
 */
export interface ConnectOptions {
  serverName: string;
  serverConfig: ServerConfig;
  redirectUrl?: string;
  onRedirect?: (url: URL) => void | Promise<void>;
  timeoutMs?: number;
}

/**
 * MCP connection with automatic cleanup
 */
export class McpConnection implements AsyncDisposable {
  constructor(
    public readonly client: Client,
    public readonly transport: McpTransport,
  ) {}

  /**
   * Clean up MCP client and transport
   */
  async cleanup(): Promise<void> {
    // For HTTP transports, terminate the session before closing the client
    if (this.transport instanceof StreamableHTTPClientTransport) {
      try {
        await this.transport.terminateSession();
      } catch (error) {
        logger.error(`Error terminating HTTP session: ${error}`);
      }
    }

    try {
      await this.client.close();
    } catch (error) {
      logger.error(`Error closing client: ${error}`);
    }

    try {
      await this.transport.close();
    } catch (error) {
      logger.error(`Error closing transport: ${error}`);
    }
  }

  /**
   * Automatic cleanup for async disposal
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Connect to MCP server with timeout
 *
 * @param options - Connection options
 * @returns Client and transport instances
 * @throws {Error} If connection fails or times out
 */
export async function connectToServer(
  options: ConnectOptions,
): Promise<McpConnection> {
  const {
    serverName,
    serverConfig,
    redirectUrl,
    onRedirect,
    timeoutMs = 30000, // 30 second default timeout
  } = options;

  logger.debug(`Connecting to ${serverConfig.type} server: ${serverName}`);

  // Create transport
  const transport = createTransport({
    serverName,
    serverConfig,
    redirectUrl,
    onRedirect,
  });

  const client = new Client(
    {
      name: "Toolscript",
      version: packageInfo.version,
    },
    { capabilities: {} },
  );

  try {
    await deadline(client.connect(transport), timeoutMs);
    logger.debug(`Connected to ${serverConfig.type} server: ${serverName}`);
    return new McpConnection(client, transport);
  } catch (error) {
    try {
      await client.close();
      await transport.close();
    } catch (error) {
      console.error(`Error cleaning failed connection to ${serverConfig.type} server: ${error}`);
    }

    throw error;
  }
}
