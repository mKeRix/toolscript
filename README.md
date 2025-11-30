# Toolscript

> Deno-native MCP code mode: Execute TypeScript code that calls MCP tools with full type safety.

Toolscript is a lightweight CLI tool and Claude Code plugin that enables LLMs to write TypeScript code calling MCP (Model Context Protocol) tools. It provides automatic type generation, sandboxed execution, and seamless Claude Code integration.

## Features

- **Type-Safe MCP Access**: Automatic TypeScript type generation from MCP tool schemas
- **Semantic Tool Search**: AI-powered search using embeddings + fuzzy matching for tool discovery
- **Sandboxed Execution**: Secure Deno sandbox with minimal permissions
- **Zero Configuration**: Works out of the box, add config only when needed
- **Claude Plugin**: Automatic gateway lifecycle management via SessionStart/SessionEnd hooks
- **Multi-Server Support**: Aggregate tools from multiple MCP servers
- **Clean Imports**: Use `import { tools } from "toolscript"` in your scripts

## Quick Start

### Installation

#### From Source (Development)

```bash
# Clone the repository
cd /path/to/toolscript

# Install globally
deno install --global \
  --allow-net --allow-read --allow-write --allow-env --allow-run --allow-sys \
  --name toolscript \
  --config deno.json \
  --force \
  src/cli/main.ts

# If using asdf, reshim to make command available
asdf reshim deno

# Verify installation
toolscript --help
```

#### From JSR (Coming Soon)

```bash
deno install --global --allow-all --name toolscript jsr:@toolscript/cli
```

### Configuration

Create `.toolscript.json` in your project root:

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

### Start Gateway

```bash
toolscript gateway start
```

The gateway will print the `TOOLSCRIPT_GATEWAY_URL` environment variable.

### Write and Execute Toolscripts

Create `example.ts`:

```typescript
import { tools } from "toolscript";

const files = await tools.filesystem.listDirectory({
  path: "/tmp",
});

console.log("Files:", files);
```

Execute:

```bash
toolscript exec --file example.ts
```

Or inline:

```bash
toolscript exec 'import { tools } from "toolscript"; console.log(await tools.filesystem.listDirectory({ path: "/tmp" }))'
```

## CLI Commands

### Gateway Management

```bash
# Start gateway (runs until stopped)
toolscript gateway start [--port <port>] [--hostname <host>] [--config <path>]

# Configure semantic search
toolscript gateway start \
  --search-device cpu \
  --search-model "Xenova/all-MiniLM-L6-v2" \
  --search-alpha 0.7

# Check status
toolscript gateway status [--pid-file <path>]
```

### Discovery

```bash
# List configured servers
toolscript list-servers

# List tools from a server (requires running gateway)
toolscript list-tools <server-name>

# Get TypeScript types for tools
toolscript get-types --filter <server-name>
toolscript get-types --filter <server-name>,<server2-name>__<tool-name>
```

### Search

```bash
# Search for tools using semantic + fuzzy matching
toolscript search "add two numbers" --limit 5

# Output as TypeScript types
toolscript search "file operations" --output types

# Adjust search parameters
toolscript search "text manipulation" \
  --limit 3 \
  --threshold 0.4
```

### Execution

```bash
# Execute inline code
toolscript exec '<code>'

# Execute from file
toolscript exec --file <path>
```

For detailed CLI documentation, see [docs/cli.md](docs/cli.md).

## Claude Code Plugin

When installed as a Claude Code plugin, toolscript automatically:

1. **SessionStart**: Starts gateway in background, exports `TOOLSCRIPT_GATEWAY_URL`
2. **SessionEnd**: Stops gateway and cleans up

The `toolscript` skill provides LLMs with context on how to use toolscript effectively.

## Architecture

```
┌─────────────────────┐
│   Toolscript CLI    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌──────────────────┐
│  Gateway Server     │◄────►│  MCP Server 1    │
│  (HTTP)             │      └──────────────────┘
│  - Type Generation  │      ┌──────────────────┐
│  - Tool Aggregation │◄────►│  MCP Server 2    │
│  - /runtime/tools.ts│      └──────────────────┘
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandboxed Deno     │
│  Subprocess         │
│  - Network: Gateway │
│  - No FS access     │
└─────────────────────┘
```

## Security Model

Toolscripts execute in a restricted Deno sandbox:

```bash
deno run \
  --allow-net=localhost:PORT  # Only gateway access
  --import-map=<temp>         # Clean imports
  --no-prompt                 # No interactive prompts
  script.ts
```

Environment:

- `TOOLSCRIPT_GATEWAY_URL`: Gateway URL for HTTP imports
- No file system access
- No environment variable access (except TOOLSCRIPT_GATEWAY_URL)

## Configuration

### Format

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "command",
      "args": ["arg1", "arg2"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### Server Types

- **stdio**: Command-line MCP servers
- **http**: HTTP-based MCP servers with optional OAuth2
- **sse**: SSE-based MCP servers with optional OAuth2

### Environment Variables

Use `${VAR}` or `${VAR:-default}` syntax for environment variable substitution.

## OAuth2 Authentication

Toolscript supports OAuth2 authentication for HTTP and SSE MCP servers using the Authorization Code flow.

### Quick Start

1. **Add OAuth config** to your `.toolscript.json`:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.github.com/mcp",
      "oauth": {
        "clientId": "${GITHUB_CLIENT_ID}"
      }
    }
  }
}
```

2. **Authenticate**:

```bash
toolscript auth github
```

This will:
- Perform OAuth discovery
- Open your browser for authorization
- Store credentials securely in `~/.toolscript/oauth/`
- Tokens are automatically refreshed by the MCP SDK

3. **Use authenticated servers**:

```bash
toolscript gateway start
# Gateway automatically uses stored OAuth credentials
```

### Authentication Flow

**Authorization Code** (interactive, user-facing):
- Requires `toolscript auth <server>` command
- Opens browser for user authorization
- Tokens are automatically refreshed

### Checking Auth Status

```bash
# List all OAuth2 servers and their authentication status
toolscript auth

# Example output:
# OAuth2 Servers:
#
# Status  Server   Authentication
# ✓       github   authenticated
# ✗       gitlab   not authenticated
```

### Storage

OAuth credentials are stored in:
- Location: `~/.toolscript/oauth/<server-name>.json`
- Permissions: 0600 (read/write owner only)
- Contains: Client registration + access/refresh tokens

### Requirements

- OAuth2-protected MCP servers must support OAuth discovery
- `clientId` required in OAuth configuration

## Examples

See `docs/examples/` for more examples.

## Development

```bash
# Format code
deno fmt

# Lint code
deno lint

# Run tests
deno test

# Run CLI
deno task cli <command>
```

## License

MIT

## Contributing

Contributions welcome! Please see CONTRIBUTING.md for guidelines.
