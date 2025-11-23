# Toolscript Architecture

## Overview

Toolscript consists of three main components:

1. **CLI Tool**: Command-line interface for managing gateway and executing toolscripts
2. **Gateway Server**: Long-running HTTP server that aggregates MCP servers and generates types
3. **Claude Plugin**: Lifecycle hooks and skill for Claude Code integration

## Component Details

### CLI Tool

The CLI is built with Cliffy and provides commands for:

- Gateway management (`gateway start`, `gateway status`)
- Discovery (`list-servers`, `list-tools`, `get-types`)
- Execution (`exec`)

Entry point: `src/cli/main.ts`

### Gateway Server

The gateway server is an HTTP server that:

1. Connects to configured MCP servers at startup
2. Aggregates tools from all servers with `server__tool` naming
3. Generates TypeScript client code from tool schemas
4. Serves client code via `/runtime/tools.ts` endpoint
5. Proxies tool calls to appropriate MCP servers

Key modules:

- `src/gateway/server.ts`: HTTP server implementation
- `src/gateway/aggregator.ts`: Multi-server aggregation logic
- `src/gateway/mcp-client.ts`: MCP client wrapper

### Type Generation

Type generation converts MCP tool schemas to TypeScript:

1. Fetch tool schemas from all connected servers
2. Convert server/tool names to TypeScript identifiers (camelCase for functions, PascalCase for types)
3. Generate parameter and result interfaces
4. Generate client functions that call gateway HTTP endpoints
5. Cache generated module in memory

Key modules:

- `src/types/generator.ts`: Type generation logic
- `src/types/naming.ts`: Naming convention conversion

### Execution Sandbox

Toolscripts execute in a Deno subprocess with:

- Network access limited to gateway server only
- Dynamic import map mapping `"toolscript"` to gateway URL
- Environment variable `TOOLSCRIPT_GATEWAY_URL` set

Key modules:

- `src/execution/sandbox.ts`: Sandbox configuration and execution

### Claude Plugin

The plugin provides:

- **SessionStart Hook**: Starts gateway in background, writes PID file, exports `TOOLSCRIPT_GATEWAY_URL`
- **SessionEnd Hook**: Kills gateway process, cleans up PID file
- **Toolscript Skill**: Provides LLMs with usage instructions and examples

Plugin directory: `plugins/toolscript/`

## Data Flow

### Toolscript Execution Flow

```
1. User: toolscript exec 'code'
2. CLI: Create import map: { "toolscript": "http://localhost:PORT/runtime/tools.ts" }
3. CLI: Write code to temp file
4. CLI: Spawn Deno subprocess with sandbox permissions
5. Subprocess: Import tools from gateway HTTP endpoint
6. Subprocess: Execute code, call tools via fetch()
7. Gateway: Proxy tool calls to MCP servers
8. Gateway: Return results
9. Subprocess: Output to stdout/stderr
10. CLI: Capture and display output
```

### Type Generation Flow

```
1. Gateway: Connect to MCP servers
2. Gateway: Fetch tool schemas from each server
3. Gateway: For each tool:
   a. Convert server/tool names to TypeScript identifiers
   b. Generate Params and Result interfaces
   c. Generate async function with fetch() call
4. Gateway: Combine into single module
5. Gateway: Cache in memory
6. Gateway: Serve via /runtime/tools.ts endpoint
```

### Claude Plugin Flow

```
SessionStart:
1. Hook: Start gateway in background
2. Hook: Write PID to temp file
3. Hook: Export TOOLSCRIPT_GATEWAY_URL
4. Claude: Skill available to LLM

During Session:
1. LLM: Request toolscript execution
2. LLM: Call CLI via bash commands
3. CLI: Execute toolscript
4. LLM: Process results

SessionEnd:
1. Hook: Read PID from file
2. Hook: Kill gateway process
3. Hook: Cleanup PID file
```

## Configuration

Configuration is loaded from `.toolscript.json`:

1. Parse JSON file
2. Substitute environment variables (`${VAR}`, `${VAR:-default}`)
3. Validate against schema
4. Pass to gateway for server connections

If no config file exists:

- Gateway starts with zero servers
- Serves empty tools module: `export const tools = {};`
- All CLI commands handle gracefully

## Security

### Sandbox Permissions

Toolscripts run with minimal permissions:

```bash
deno run \
  --allow-net=localhost:PORT  # Only gateway
  --import-map=<temp>         # Import resolution
  --no-prompt                 # No interactive prompts
  script.ts
```

### Gateway Isolation

- Gateway is the only component with MCP server access
- Toolscripts can only call gateway HTTP endpoints
- No direct MCP server access from toolscripts

### Environment Variables

- Toolscripts have no access to host environment variables
- Only `TOOLSCRIPT_GATEWAY_URL` is set
- MCP server credentials stay in gateway process

## Error Handling

### Gateway Errors

- Server connection failures: Log error, continue with other servers
- Tool call failures: Return error response to client
- Type generation errors: Serve empty module, log error

### Execution Errors

- Import errors: Reported via stderr
- Runtime errors: Reported via stderr
- Network errors: Reported via stderr
- Exit code: 0 for success, 1 for failure

### Plugin Errors

- Gateway start failure: Report to user, Claude session continues
- Gateway crash: Skill reports unhealthy status, no auto-restart
- Missing config: Gateway starts with zero servers, no error

## Extension Points

Future enhancements:

1. **HTTP/SSE Server Support**: Add HTTP and SSE transport implementations
2. **Persistent Type Cache**: Add file-based cache option for faster restarts
3. **Watch Mode**: Auto-regenerate types when servers change
4. **Tool Versioning**: Track and handle tool schema version changes
5. **Metrics/Telemetry**: Add optional metrics collection
