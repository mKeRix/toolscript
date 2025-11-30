/**
 * Multi-server aggregation logic.
 */

import type { ToolscriptConfig } from "../config/types.ts";
import { McpClient } from "./mcp-client.ts";
import { getLogger } from "../utils/logger.ts";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";

const logger = getLogger("aggregator");

/**
 * Tool information
 */
export interface ToolInfo {
  serverName: string;
  toolName: string;
  qualifiedName: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
}

/**
 * Aggregator for multiple MCP servers with automatic cleanup
 */
export class ServerAggregator implements AsyncDisposable {
  private clients: Map<string, McpClient> = new Map();
  private tools: Map<string, ToolInfo> = new Map();

  /**
   * Initialize and connect to all configured servers
   * @param config - Toolscript configuration
   */
  async initialize(config: ToolscriptConfig): Promise<void> {
    logger.info("Initializing server aggregator");

    // Connect to all servers in parallel
    const connectionPromises = Object.entries(config.mcpServers).map(
      async ([name, serverConfig]) => {
        try {
          const client = new McpClient(name, serverConfig);
          await client.connect();
          this.clients.set(name, client);
          return { name, success: true };
        } catch (error) {
          logger.error(`Failed to connect to server ${name}: ${error}`);
          if (error instanceof UnauthorizedError) {
            logger.error(`To authenticate, please run: toolscript auth ${name}`);
          }
          return { name, success: false, error };
        }
      },
    );
    const results = await Promise.allSettled(connectionPromises);

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - successful;
    logger.info(`Connected to ${successful}/${results.length} servers (${failed} failed)`);

    await this.refreshTools();
  }

  /**
   * Refresh the tool catalog from all servers
   */
  async refreshTools(): Promise<void> {
    this.tools.clear();

    for (const [serverName, client] of this.clients) {
      try {
        const tools = await client.listTools();
        logger.debug(`Raw tools response from ${serverName}: ${JSON.stringify(tools)}`);

        if (!tools || !Array.isArray(tools)) {
          logger.error(`Invalid tools response from ${serverName}: not an array`);
          continue;
        }

        for (const tool of tools) {
          if (!tool || !tool.name) {
            logger.warn(`Skipping invalid tool from ${serverName}:`, tool);
            continue;
          }

          const qualifiedName = `${serverName}__${tool.name}`;
          this.tools.set(qualifiedName, {
            serverName,
            toolName: tool.name,
            qualifiedName,
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
          });
        }
        logger.info(`Loaded ${tools.length} tools from server: ${serverName}`);
      } catch (error) {
        logger.error(`Failed to list tools from server ${serverName}: ${error}`);
        if (error instanceof Error) {
          logger.error(`Error message: ${error.message}`);
          logger.error(`Error stack: ${error.stack}`);
        }
      }
    }
  }

  /**
   * Get all server names
   */
  getServerNames(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get information about all connected servers
   */
  getServers(): Array<{ name: string; title?: string; instructions?: string }> {
    const servers: Array<{ name: string; title?: string; instructions?: string }> = [];
    for (const [name, client] of this.clients) {
      const serverInfo = client.getServerInfo();
      servers.push({
        name,
        title: serverInfo?.title || serverInfo?.name,
        instructions: serverInfo?.instructions,
      });
    }
    return servers;
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolInfo[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by filter string.
   *
   * Filter format: comma-separated identifiers
   * - "servername" - all tools from a server
   * - "servername__toolname" - specific tool
   * - "server1,server2__tool" - multiple filters
   *
   * @param filter Comma-separated filter string
   * @returns Matching tools
   */
  getToolsByFilter(filter: string): ToolInfo[] {
    if (!filter || filter.trim() === "") {
      return this.getAllTools();
    }

    const filters = filter.split(",").map((f) => f.trim()).filter(Boolean);
    const matchedTools = new Set<ToolInfo>();

    for (const f of filters) {
      if (f.includes("__")) {
        // Specific tool: server__toolname
        const tool = this.tools.get(f);
        if (tool) {
          matchedTools.add(tool);
        }
      } else {
        // Server name: all tools from this server
        for (const tool of this.tools.values()) {
          if (tool.serverName === f) {
            matchedTools.add(tool);
          }
        }
      }
    }

    return Array.from(matchedTools);
  }

  /**
   * Get a single tool by qualified name
   */
  getTool(qualifiedName: string): ToolInfo | undefined {
    return this.tools.get(qualifiedName);
  }

  /**
   * Call a tool
   */
  async callTool(qualifiedName: string, args: Record<string, unknown>): Promise<unknown> {
    const toolInfo = this.tools.get(qualifiedName);
    if (!toolInfo) {
      throw new Error(`Tool not found: ${qualifiedName}`);
    }

    const client = this.clients.get(toolInfo.serverName);
    if (!client) {
      throw new Error(`Server not connected: ${toolInfo.serverName}`);
    }

    return await client.callTool(toolInfo.toolName, args);
  }

  /**
   * Shutdown all clients
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down server aggregator");
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.tools.clear();
  }

  /**
   * Symbol.asyncDispose for explicit resource management (using pattern)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.shutdown();
  }
}
