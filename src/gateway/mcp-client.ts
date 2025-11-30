/**
 * MCP client connection management.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ServerConfig } from "../config/types.ts";
import { getLogger } from "../utils/logger.ts";
import { connectToServer, McpConnection } from "./mcp-utils.ts";

const logger = getLogger("mcp-client");

/**
 * Server information from MCP
 */
export interface ServerInfo {
  name: string;
  title?: string;
  version: string;
  instructions?: string;
}

/**
 * MCP client wrapper with connection state and automatic cleanup
 */
export class McpClient implements AsyncDisposable {
  private connection: McpConnection | null = null;
  private serverInfo: ServerInfo | null = null;

  constructor(
    public readonly name: string,
    private readonly config: ServerConfig,
  ) {}

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    logger.info(`Connecting to ${this.config.type} server: ${this.name}`);

    // Use common connection utilities
    // Note: No redirectUrl passed - will fail on auth errors instead of initiating flow
    this.connection = await connectToServer({
      serverName: this.name,
      serverConfig: this.config,
      // No redirectUrl - OAuth provider will fail on auth errors
      // User must authenticate separately using 'toolscript auth <server-name>'
      timeoutMs: 30000, // 30 second timeout
    });

    // Get server information
    const version = this.connection.client.getServerVersion();
    const instructions = this.connection.client.getInstructions();

    this.serverInfo = {
      name: version?.name || this.name,
      version: version?.version || "unknown",
      instructions,
    };

    logger.info(`Connected to ${this.config.type} server: ${this.name}`);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.cleanup();
      this.connection = null;
    }
    logger.info(`Disconnected from server: ${this.name}`);
  }

  /**
   * Get the connected client
   */
  getClient(): Client {
    if (!this.connection) {
      throw new Error(`Client not connected: ${this.name}`);
    }
    return this.connection.client;
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Get server information
   */
  getServerInfo(): ServerInfo | null {
    return this.serverInfo;
  }

  /**
   * List available tools from this server
   */
  async listTools(): Promise<
    Array<{ name: string; description?: string; inputSchema: unknown; outputSchema?: unknown }>
  > {
    const client = this.getClient();
    try {
      const response = await client.listTools();
      logger.debug(`listTools response for ${this.name}: ${JSON.stringify(response, null, 2)}`);
      return response.tools;
    } catch (error) {
      logger.error(`Error listing tools for ${this.name}: ${error}`);
      // Try to get request/response details if available
      if (error && typeof error === "object" && "cause" in error) {
        logger.error(`Error cause: ${(error as { cause: unknown }).cause}`);
      }
      throw error;
    }
  }

  /**
   * Call a tool on this server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.getClient();
    const response = await client.callTool({
      name,
      arguments: args,
    });
    return response.content;
  }

  /**
   * Automatic cleanup when using `await using` syntax
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.disconnect();
  }
}
