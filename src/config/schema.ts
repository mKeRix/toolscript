/**
 * Configuration validation using Zod schemas.
 * Matches Claude Code's MCP server configuration format.
 */

import { z } from "zod";

/**
 * Stdio server configuration schema
 */
const stdioServerSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  includeTools: z.array(z.string()).optional(),
  excludeTools: z.array(z.string()).optional(),
});

/**
 * HTTP server configuration schema
 */
const httpServerSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  includeTools: z.array(z.string()).optional(),
  excludeTools: z.array(z.string()).optional(),
});

/**
 * SSE server configuration schema
 */
const sseServerSchema = z.object({
  type: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  includeTools: z.array(z.string()).optional(),
  excludeTools: z.array(z.string()).optional(),
});

/**
 * Union schema for all server types
 */
export const serverConfigSchema = z.discriminatedUnion("type", [
  stdioServerSchema,
  httpServerSchema,
  sseServerSchema,
]);

/**
 * Root configuration schema
 */
export const toolscriptConfigSchema = z.object({
  mcpServers: z.record(serverConfigSchema),
});
