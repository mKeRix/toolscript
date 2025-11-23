#!/usr/bin/env -S deno run --allow-all
/**
 * SSE MCP server for E2E testing.
 * Uses SDK's SSEServerTransport for proper SSE protocol support.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";

// Get port from command line args
const port = parseInt(Deno.args[0] || "0");
if (port === 0) {
  console.error("Error: Port must be specified as first argument");
  Deno.exit(1);
}

// Create MCP server instance
const mcpServer = new Server(
  {
    name: "sse-test-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register tools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: "reverse",
        description: "Reverse a string (SSE transport)",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to reverse",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "uppercase",
        description: "Convert text to uppercase (SSE transport)",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to convert",
            },
          },
          required: ["text"],
        },
      },
    ],
  };
});

// Register tool call handler
mcpServer.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "reverse": {
      const text = (args as { text: string }).text;
      const reversed = text.split("").reverse().join("");
      return {
        content: [
          {
            type: "text",
            text: `Reversed: ${reversed}`,
          },
        ],
      };
    }

    case "uppercase": {
      const text = (args as { text: string }).text;
      const upper = text.toUpperCase();
      return {
        content: [
          {
            type: "text",
            text: `Uppercase: ${upper}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Track active transports
const transports: { [sessionId: string]: SSEServerTransport } = {};

// Create Express app
const app = express();
app.use(express.json());

// SSE endpoint - establishes the event stream
app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/message", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[transport.sessionId];
  });

  await mcpServer.connect(transport);
});

// Message endpoint - handles JSON-RPC messages from client
app.post("/message", async (req, res) => {
  // Session ID comes as query parameter, not header
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId query parameter" });
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Pass the parsed body to handlePostMessage
  await transport.handlePostMessage(req, res, req.body);
});

console.log(`SSE MCP server starting on http://localhost:${port}`);
app.listen(port, "localhost");
