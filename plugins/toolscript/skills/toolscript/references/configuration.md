# Toolscript Configuration Reference

This document provides detailed information about configuring MCP servers in toolscript.

## Gateway

The toolscript gateway is automatically started when your Claude Code session begins via SessionStart hook. The gateway:
- Manages connections to all configured MCP servers
- Handles MCP server authentication and credentials
- Provides a unified interface to access tools from all servers
- Deals with upstream server communication and protocol details

**Important:** Do not try to start/restart the gateway yourself. Ask the user to restart their Claude Code session to restart the gateway.

## Requirements

Deno 2.x and toolscript must be installed globally:

```bash
deno install --global --unstable-webgpu --allow-net --allow-read --allow-write --allow-env --allow-run --allow-sys --allow-ffi --name toolscript jsr:@toolscript/cli
```

After installing toolscript for the first time, restart the Claude Code session for it to become available.

## Configuration File Location

Toolscript looks for `.toolscript.json` in the following locations (in order):

1. Current project directory
2. User home directory (`~/.toolscript.json`)

If no configuration file exists, the gateway starts with zero servers and serves an empty tools module.

## Configuration Format

The configuration file uses JSON format with an `mcpServers` object containing server definitions:

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio|http|sse",
      ...server-specific configuration
    }
  }
}
```

## Server Types

Toolscript supports three types of MCP servers:

### 1. stdio Servers

Standard input/output servers that communicate via stdin/stdout. This is the most common server type.

**Configuration:**

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

**Fields:**

- `type`: Must be `"stdio"`
- `command`: Executable to run (e.g., `"npx"`, `"node"`, `"python"`, `"deno"`)
- `args`: Array of arguments to pass to the command
- `env` (optional): Environment variables to set for the server process
  - Use `${VAR_NAME}` to reference environment variables from the host

**Example - NPX Server:**

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

**Example - Node Script:**

```json
{
  "mcpServers": {
    "custom": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}
```

**Example - Python Server:**

```json
{
  "mcpServers": {
    "python-server": {
      "type": "stdio",
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "env": {
        "PYTHON_PATH": "/usr/local/lib/python3.11"
      }
    }
  }
}
```

### 2. HTTP Servers

Servers that communicate via HTTP REST API.

**Configuration:**

```json
{
  "mcpServers": {
    "http-server": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}",
        "Content-Type": "application/json"
      }
    }
  }
}
```

**Fields:**

- `type`: Must be `"http"`
- `url`: Base URL of the HTTP MCP server
- `headers` (optional): HTTP headers to include in requests
  - Use `${VAR_NAME}` to reference environment variables from the host

**Example - Authenticated HTTP Server:**

```json
{
  "mcpServers": {
    "cloud-mcp": {
      "type": "http",
      "url": "https://mcp.example.com/v1",
      "headers": {
        "Authorization": "Bearer ${MCP_API_KEY}",
        "X-Client-ID": "${CLIENT_ID}"
      }
    }
  }
}
```

### 3. SSE Servers

Servers that communicate via Server-Sent Events (SSE) for real-time streaming.

**Configuration:**

```json
{
  "mcpServers": {
    "sse-server": {
      "type": "sse",
      "url": "https://events.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

**Fields:**

- `type`: Must be `"sse"`
- `url`: URL of the SSE endpoint
- `headers` (optional): HTTP headers to include in the SSE connection
  - Use `${VAR_NAME}` to reference environment variables from the host

**Example - SSE Server with Authentication:**

```json
{
  "mcpServers": {
    "realtime-mcp": {
      "type": "sse",
      "url": "https://stream.example.com/mcp/events",
      "headers": {
        "Authorization": "Bearer ${SSE_TOKEN}",
        "X-Stream-ID": "toolscript-client"
      }
    }
  }
}
```

## Environment Variable Substitution

All server types support environment variable substitution using the `${VAR_NAME}` syntax:

- In `env` object (stdio servers)
- In `headers` object (http/sse servers)
- In `url` field (http/sse servers)

**Example:**

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "api-service": {
      "type": "http",
      "url": "https://${API_HOST}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

Variables are resolved from the environment where Claude Code is running.

## Complete Configuration Example

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/workspace"]
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "cloud-api": {
      "type": "http",
      "url": "https://api.example.com/mcp/v1",
      "headers": {
        "Authorization": "Bearer ${CLOUD_API_KEY}"
      }
    },
    "realtime-events": {
      "type": "sse",
      "url": "https://events.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${EVENT_TOKEN}"
      }
    }
  }
}
```

## Configuration Validation

When the gateway starts, it validates the configuration:

- Checks that `.toolscript.json` is valid JSON
- Verifies each server has a valid `type` field
- Validates required fields for each server type
- Reports configuration errors in gateway logs

## Troubleshooting Configuration

**Invalid JSON:**
- Check for syntax errors (missing commas, quotes, brackets)
- Use a JSON validator to verify file structure

**Server not appearing:**
- Check server name is valid (alphanumeric and hyphens only)
- Verify `type` field matches one of: `stdio`, `http`, `sse`
- Ensure all required fields are present for the server type

**Environment variables not resolved:**
- Check variables are set in the environment where Claude Code runs
- Verify syntax is `${VAR_NAME}` (not `$VAR_NAME` or `{VAR_NAME}`)
- Check gateway logs for substitution errors

**Connection failures:**
- For stdio: Verify command and args are correct, executable exists
- For http/sse: Check URL is reachable, authentication headers are valid
- Review gateway logs at `/tmp/toolscript-gateway-*.log`

## Security Considerations

**Credentials in configuration:**
- Never commit `.toolscript.json` with actual credentials to version control
- Always use environment variable substitution for sensitive data
- Add `.toolscript.json` to `.gitignore` if it contains credentials

**Example .gitignore:**
```
.toolscript.json
```

**Example shared config (safe to commit):**
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Users can then set `GITHUB_TOKEN` in their environment without exposing credentials in the repository.
