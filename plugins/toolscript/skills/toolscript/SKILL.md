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

Use semantic search for efficient tool discovery:

1. **Search for tools** - Find relevant tools using natural language
2. **Get tool types** - Use `--output types` to get TypeScript code directly
3. **Execute toolscript** - Call the tool with proper parameters

### Quick Workflow (Preferred)

```bash
# Search and get types in one command
toolscript search "find files containing text" --output types
```

This returns a confidence table plus ready-to-use TypeScript code.

### Alternative Workflow (Fallback)

If search is unavailable or you need to browse all tools:

1. **List servers** - `toolscript list-servers`
2. **List tools** - `toolscript list-tools <server>`
3. **Get types** - `toolscript get-types --filter <server>`

## Gateway and Authentication

The toolscript gateway is automatically started when your Claude Code session begins via SessionStart hook. The gateway:

- Manages connections to all configured MCP servers
- Handles MCP server authentication and credentials
- Provides a unified interface to access tools from all servers
- Deals with upstream server communication and protocol details

**Important:** If errors occur communicating with upstream MCP servers (authentication failures, connection timeouts, server errors), these issues must be resolved at the gateway level, not in individual toolscripts. Check the gateway configuration, server credentials, and connectivity.

## Available Commands

### 1. Search for Tools (Recommended)

Search for tools using natural language:

```bash
toolscript search "<query>" [--limit <n>] [--threshold <score>] [--output <format>]
```

**Examples:**

```bash
# Find file-related tools (table output, default)
toolscript search "read files from disk"

# Get TypeScript types directly (types output)
toolscript search "commit git changes" --output types

# Find more results with lower threshold
toolscript search "github api" --limit 5 --threshold 0.2
```

**Output Formats:**

- `--output table` (default): Human-readable table with tool ID, confidence, and description
- `--output types`: Markdown with confidence table + TypeScript code ready for execution

**Types Output Example:**

```markdown
## Search Results

| Tool | Confidence | Reason |
|------|------------|--------|
| git__commit | 85.0% | semantic match, keyword match |
| github__create_commit | 72.3% | partial semantic match |

\`\`\`typescript
// Generated TypeScript code for the matched tools
import { tools } from "toolscript";
// ...
\`\`\`
```

### 2. List Configured Servers

Browse all available MCP servers:

```bash
toolscript list-servers
```

This shows all servers configured in `.toolscript.json` and their connection status.

### 3. List Tools from a Server

List all tools from a specific server:

```bash
toolscript list-tools <server-name>
```

This displays all tools the server provides with brief descriptions.

### 4. Get TypeScript Types

Get TypeScript types for specific tools:

```bash
toolscript get-types [--filter <filter>]
```

**Filter format:** Comma-separated list of server names or tool IDs

```bash
# All tools from a server
toolscript get-types --filter octocode

# Specific tool
toolscript get-types --filter octocode__githubSearchCode

# Multiple filters
toolscript get-types --filter github,git__commit
```

This shows the exact TypeScript interface for the tool's parameters and return value.

### 5. Execute Toolscript

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

**Search not working:**
- Check gateway is running (search requires active gateway)
- First search may be slow due to model download (~45MB)
- If semantic search fails, gateway falls back to fuzzy-only mode
- Use `--threshold 0.1` to see more results with lower confidence
- Check search stats: `curl $TOOLSCRIPT_GATEWAY_URL/search/stats`

## Examples

See `references/` directory for detailed examples and usage patterns.
