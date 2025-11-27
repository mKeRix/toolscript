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
- Search (`search`)
- Execution (`exec`)

Entry point: `src/cli/main.ts`

Command modules:
- `src/cli/commands/gateway.ts`: Gateway management
- `src/cli/commands/types.ts`: Type generation
- `src/cli/commands/search.ts`: Tool search
- `src/cli/commands/exec.ts`: Code execution

### Gateway Server

The gateway server is an HTTP server that:

1. Connects to configured MCP servers at startup
2. Aggregates tools from all servers with `server__tool` naming
3. Generates TypeScript client code from tool schemas
4. Serves client code via `/runtime/tools.ts` endpoint
5. Proxies tool calls to appropriate MCP servers
6. Provides semantic + fuzzy search over available tools
7. Exposes health endpoint with search readiness status

Key modules:

- `src/gateway/server.ts`: HTTP server implementation
- `src/gateway/aggregator.ts`: Multi-server aggregation logic
- `src/gateway/mcp-client.ts`: MCP client wrapper

### Search Engine

The search engine provides hybrid tool discovery:

1. **Semantic Search**: Vector embeddings using transformer models (transformers.js)
   - Default model: `Xenova/bge-small-en-v1.5`
   - Alternative: `Xenova/all-MiniLM-L6-v2`
   - Device support: CPU (all platforms), WebGPU
   - Understands natural language queries

2. **Fuzzy Search**: Keyword-based matching with typo tolerance
   - Fast prefix/substring matching
   - Handles typos and partial matches
   - No model download required

3. **Hybrid Fusion**: Combines semantic + fuzzy scores
   - Alpha weighting (default: 0.7 semantic, 0.3 fuzzy)
   - Configurable via `--search-alpha` flag
   - Threshold filtering (default: 0.35)

4. **Embedding Cache**: Disk-based cache for faster restarts
   - Stores embeddings by tool content hash
   - Automatically invalidates on tool changes
   - Optional disable via `--search-no-cache`

Key modules:

- `src/search/engine.ts`: Main search orchestrator
- `src/search/semantic.ts`: Semantic search with embeddings
- `src/search/fuzzy.ts`: Keyword-based fuzzy matching
- `src/search/cache.ts`: Embedding persistence
- `src/search/types.ts`: Search configuration and model definitions

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

### Tool Search Flow

```
1. User: toolscript search "find files"
2. CLI: Send search request to gateway
3. Gateway: Semantic engine generates query embedding
4. Gateway: Check cache for tool embeddings
5. Gateway: For uncached tools, generate embeddings
6. Gateway: Compute cosine similarity between query and tools
7. Gateway: Fuzzy engine performs keyword matching
8. Gateway: Combine semantic + fuzzy scores with alpha weighting
9. Gateway: Filter by threshold, sort by score
10. CLI: Display results as table or TypeScript types
```

### Search Engine Initialization Flow

```
1. Gateway starts with search configuration
2. Compute config hash from server names + model
3. Initialize embedding cache with config hash
4. Load cached embeddings from disk (if available)
5. Initialize semantic engine:
   a. Download embedding model (first run only)
   b. Load model into memory
   c. Configure device (CPU/WebGPU)
6. Initialize fuzzy engine (lightweight, no download)
7. Index all tools from connected MCP servers:
   a. Generate embeddings for new/changed tools
   b. Cache embeddings to disk
   c. Load embeddings into search engine
8. Gateway marks search as ready in /health endpoint
```

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

Implemented features:

1. ✅ **Semantic Tool Search**: AI-powered search with embeddings + fuzzy matching
2. ✅ **HTTP/SSE Server Support**: Full support for stdio, HTTP, and SSE transports
3. ✅ **Embedding Cache**: Disk-based persistence for faster restarts

Future enhancements:

1. **Watch Mode**: Auto-regenerate types when servers change
2. **Tool Versioning**: Track and handle tool schema version changes
3. **Metrics/Telemetry**: Add optional metrics collection
4. **Alternative Embedding Models**: Support for local models, OpenAI, etc.
5. **Search Relevance Feedback**: Learn from user selections to improve ranking
