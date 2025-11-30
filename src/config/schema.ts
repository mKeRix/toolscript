/**
 * Configuration validation using Zod schemas.
 * Matches Claude Code's MCP server configuration format.
 */

import { z } from "zod";

/**
 * OAuth2 configuration schema
 * Uses OAuth discovery - manual endpoint configuration is not supported
 * clientId is optional - uses dynamic registration if not provided
 */
const oauth2ConfigSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
}).passthrough().refine(
  (data) => {
    // Reject manual OAuth endpoint configuration - we use OAuth discovery
    const invalidFields = ["authorizationUrl", "tokenUrl", "redirectUri", "flow"];
    const hasInvalidField = invalidFields.some((field) => field in data);
    return !hasInvalidField;
  },
  {
    message:
      "Manual OAuth endpoints are not supported. OAuth2 configuration uses automatic discovery from the MCP server.",
  },
);

/**
 * Stdio server configuration schema
 */
const stdioServerSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

/**
 * HTTP server configuration schema
 */
const httpServerSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  oauth: oauth2ConfigSchema.optional(),
});

/**
 * SSE server configuration schema
 */
const sseServerSchema = z.object({
  type: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  oauth: oauth2ConfigSchema.optional(),
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
