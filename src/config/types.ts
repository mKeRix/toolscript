/**
 * Configuration type definitions for toolscript.
 * Matches Claude Code's MCP server configuration format.
 */

/**
 * Server type enumeration
 */
export type ServerType = "stdio" | "http" | "sse";

/**
 * Base server configuration
 */
export interface BaseServerConfig {
  type: ServerType;
  /**
   * Optional list of tool names to include from this server.
   * If specified, only these tools will be served.
   * Tool names must be exact matches.
   */
  includeTools?: string[];
  /**
   * Optional list of tool names to exclude from this server.
   * If specified, these tools will not be served.
   * Tool names must be exact matches.
   * Exclude filters are applied after include filters.
   */
  excludeTools?: string[];
}

/**
 * Stdio server configuration
 */
export interface StdioServerConfig extends BaseServerConfig {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * HTTP server configuration
 */
export interface HttpServerConfig extends BaseServerConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

/**
 * SSE server configuration
 */
export interface SseServerConfig extends BaseServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

/**
 * Union type for all server configurations
 */
export type ServerConfig = StdioServerConfig | HttpServerConfig | SseServerConfig;

/**
 * Root configuration file structure
 */
export interface ToolscriptConfig {
  mcpServers: Record<string, ServerConfig>;
}
