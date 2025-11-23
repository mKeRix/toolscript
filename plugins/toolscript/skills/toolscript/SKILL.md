---
name: toolscript
description: This skill should be used when the user asks to "discover MCP tools", "call an MCP tool", "list available tools", "execute a tool", "use toolscript", mentions MCP server capabilities, or wants to compose multi-step MCP workflows programmatically. Provides access to MCP tool discovery, schema inspection, and execution through the toolscript gateway.
---

# Toolscript Skill

This skill enables discovering, inspecting, and calling MCP tools through the toolscript gateway. The gateway provides programmatic access to MCP servers with full type safety and automatic client generation.

## Requirements

Toolscript must be installed globally:

```bash
deno install --global --allow-all --name toolscript jsr:@toolscript/cli
```

If the user doesn't have toolscript installed, provide them with this installation command.

## When to Use

Use toolscript when:

- User wants to discover what MCP tools are available
- User needs to call MCP tools programmatically
- User wants to inspect tool schemas (input/output types)
- User needs to compose multiple MCP tool calls in workflows
- User wants type-safe access to MCP server tools

## Recommended Workflow

Follow this workflow to discover and call MCP tools:

1. **List configured servers** - Understand what MCP servers are available
2. **List tools for a server** - See which specific tools a server provides
3. **Get tool types** - Inspect input/output schema for a specific tool
4. **Execute toolscript** - Call the tool with proper parameters

This progressive discovery approach ensures proper tool selection and correct parameter usage.

## Gateway and Authentication

The toolscript gateway is automatically started when your Claude Code session begins via SessionStart hook. The gateway:

- Manages connections to all configured MCP servers
- Handles MCP server authentication and credentials
- Provides a unified interface to access tools from all servers
- Deals with upstream server communication and protocol details

**Important:** If errors occur communicating with upstream MCP servers (authentication failures, connection timeouts, server errors), these issues must be resolved at the gateway level, not in individual toolscripts. Check the gateway configuration, server credentials, and connectivity.

## Available Commands

### 1. List Configured Servers

Start by discovering what MCP servers are available:

```bash
toolscript list-servers
```

This shows all servers configured in `.toolscript.json` and their connection status.

### 2. List Tools from a Server

Once a server is identified, list its available tools:

```bash
toolscript list-tools <server-name>
```

This displays all tools the server provides with brief descriptions.

### 3. Get TypeScript Types

Before calling a tool, inspect its input/output schema:

```bash
toolscript get-types <server-name> [tool-name]
```

**Get all types from a server:**
```bash
toolscript get-types octocode
```

**Get types for a specific tool:**
```bash
toolscript get-types octocode githubSearchCode
```

This shows the exact TypeScript interface for the tool's parameters and return value.

### 4. Execute Toolscript

After understanding the tool schema, execute it:

**Inline code:**
```bash
toolscript exec '<typescript-code>'
```

**From file:**
```bash
toolscript exec --file <path-to-file.ts>
```

## Toolscript Format

Toolscripts are TypeScript files that import and use MCP tools:

```typescript
import { tools } from "toolscript";

// Call tools using generated client
const result = await tools.serverName.toolName({
  param1: "value1",
  param2: "value2",
});

console.log(result);
```

## Configuration

Create or check `.toolscript.json` in the project root:

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

## No Configuration?

If no `.toolscript.json` exists, the gateway starts with zero servers and serves an empty tools module. Inform the user they can create the config file to add MCP servers.

## Security

Toolscripts run in a Deno sandbox with:

- Network access restricted to gateway server only
- No file system access
- No environment variable access (except TOOLSCRIPT_GATEWAY_URL)

## Diagnostics

**Use these commands only when troubleshooting connection errors or unexpected behavior:**

### Gateway Status

Check if the gateway is running:

```bash
toolscript gateway status
```

This is a diagnostic command - only use when experiencing connection errors during tool execution.

### Common Issues

**Gateway not running:**
- Check `$TOOLSCRIPT_GATEWAY_URL` is set
- Check gateway process with status command
- Check logs in `/tmp/toolscript-gateway-*.log`

**No tools available:**
- Ensure `.toolscript.json` exists and is valid
- Check server connections with `list-servers`
- Restart Claude Code session to restart gateway

**Upstream server errors (authentication, timeouts, connection failures):**
- These are gateway-level issues, not toolscript issues
- Check `.toolscript.json` configuration for server credentials
- Verify server command and environment variables are correct
- Check gateway logs for detailed error messages
- Ensure required API keys are set in server configuration

## Examples

See `references/` directory for detailed examples and usage patterns.
