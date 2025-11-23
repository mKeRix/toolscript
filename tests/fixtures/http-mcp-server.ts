#!/usr/bin/env -S deno run --allow-all
/**
 * HTTP MCP server for E2E testing.
 * Uses Hono with MCP middleware.
 */

import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";

// Get port from command line args
const port = parseInt(Deno.args[0] || "0");
if (port === 0) {
  console.error("Error: Port must be specified as first argument");
  Deno.exit(1);
}

// Create MCP server instance
const mcpServer = new McpServer({
  name: "http-test-server",
  version: "1.0.0",
});

// Register tools
mcpServer.tool(
  "greet",
  "Greet someone by name (HTTP transport)",
  {
    name: z.string().describe("Name to greet"),
  },
  async ({ name }) => {
    return {
      content: [
        {
          type: "text",
          text: `Hello, ${name}! (from HTTP server)`,
        },
      ],
    };
  },
);

mcpServer.tool(
  "multiply",
  "Multiply two numbers (HTTP transport)",
  {
    x: z.number().describe("First number"),
    y: z.number().describe("Second number"),
  },
  async ({ x, y }) => {
    const result = x * y;
    return {
      content: [
        {
          type: "text",
          text: `${x} * ${y} = ${result}`,
        },
      ],
    };
  },
);

// Create Hono app and setup MCP transport
const app = new Hono();
const transport = new StreamableHTTPTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

// Connect the MCP server to the transport once
await mcpServer.connect(transport);

// Setup MCP endpoint - just handle requests with the connected transport
app.all("/", (c) => transport.handleRequest(c));

console.log(`HTTP MCP server starting on http://localhost:${port}`);
Deno.serve({ port, hostname: "localhost" }, app.fetch);
