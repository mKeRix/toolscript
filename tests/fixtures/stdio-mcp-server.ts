#!/usr/bin/env -S deno run --allow-all
/**
 * Dummy MCP server for E2E testing.
 * Provides simple tools for testing gateway functionality.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Create MCP server instance
const server = new Server(
  {
    name: "stdio-test-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register tools handler
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echo back the input message",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "add",
        description: "Add two numbers together",
        inputSchema: {
          type: "object",
          properties: {
            a: {
              type: "number",
              description: "First number",
            },
            b: {
              type: "number",
              description: "Second number",
            },
          },
          required: ["a", "b"],
        },
      },
      {
        name: "get_current_time",
        description: "Get the current time in ISO format",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "echo": {
      const message = (args as { message: string }).message;
      return {
        content: [
          {
            type: "text",
            text: `Echo: ${message}`,
          },
        ],
      };
    }

    case "add": {
      const { a, b } = args as { a: number; b: number };
      const result = a + b;
      return {
        content: [
          {
            type: "text",
            text: `${a} + ${b} = ${result}`,
          },
        ],
      };
    }

    case "get_current_time": {
      const now = new Date().toISOString();
      return {
        content: [
          {
            type: "text",
            text: now,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
