/**
 * MCP client connection management.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { ServerConfig } from "../config/types.ts";
import { getLogger } from "../utils/logger.ts";
import packageInfo from "../../deno.json" with { type: "json" }

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
 * MCP client wrapper with connection state
 */
export class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null = null;
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

    // Create appropriate transport based on server type
    if (this.config.type === "stdio") {
      const env = this.config.env || {};
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
        env: { ...Deno.env.toObject(), ...env },
      });
    } else if (this.config.type === "http") {
      const url = new URL(this.config.url);
      const options = this.config.headers
        ? { requestInit: { headers: this.config.headers } }
        : {};
      this.transport = new StreamableHTTPClientTransport(url, options);
    } else if (this.config.type === "sse") {
      const url = new URL(this.config.url);
      const options = this.config.headers
        ? { requestInit: { headers: this.config.headers } }
        : {};
      this.transport = new SSEClientTransport(url, options);
    } else {
      // TypeScript exhaustiveness check
      const exhaustiveCheck: never = this.config;
      throw new Error(`Unsupported server type: ${(exhaustiveCheck as ServerConfig).type}`);
    }

    // Create and connect client
    this.client = new Client(
      {
        name: "toolscript-gateway",
        version: packageInfo.version,
      },
      {
        capabilities: {},
      },
    );

    await this.client.connect(this.transport);

    // Get server information
    const version = this.client.getServerVersion();
    const instructions = (this.client as any)._initializeResult?.instructions;

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
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    logger.info(`Disconnected from server: ${this.name}`);
  }

  /**
   * Get the connected client
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error(`Client not connected: ${this.name}`);
    }
    return this.client;
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.client !== null;
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
  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown; outputSchema?: unknown }>> {
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
}
