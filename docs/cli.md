# CLI Reference

Complete reference for the `toolscript` command-line interface.

## Global Options

```bash
--help, -h      Show help information
--version, -v   Show version number
```

## Commands

### `gateway start`

Start the MCP gateway server.

```bash
toolscript gateway start [options]
```

**Options:**

```bash
--port <number>              Port to listen on (default: 3000)
--hostname <string>          Hostname to bind to (default: "localhost")
--config <path>              Path to config file (default: ".toolscript.json")
--search-model <name>        Embedding model for semantic search
                             (default: "Xenova/bge-small-en-v1.5")
--search-device <device>     Device for search engine: auto, cpu, gpu
                             (default: "auto")
--search-alpha <number>      Weight for semantic vs fuzzy search (0-1)
                             0 = fuzzy only, 1 = semantic only
                             (default: 0.7)
--search-no-cache            Disable embedding cache
--data-dir <path>            Data directory for cache storage
                             (default: OS temp directory)
```

**Environment Variables:**

All options can be set via environment variables with `TOOLSCRIPT_` prefix:

```bash
TOOLSCRIPT_PORT=3000
TOOLSCRIPT_HOSTNAME=localhost
TOOLSCRIPT_CONFIG=.toolscript.json
TOOLSCRIPT_SEARCH_MODEL=Xenova/bge-small-en-v1.5
TOOLSCRIPT_SEARCH_DEVICE=auto
TOOLSCRIPT_SEARCH_ALPHA=0.7
TOOLSCRIPT_SEARCH_NO_CACHE=true
TOOLSCRIPT_DATA_DIR=/tmp/toolscript
```

**Examples:**

```bash
# Start with defaults
toolscript gateway start

# Start on specific port
toolscript gateway start --port 8080

# Configure semantic search
toolscript gateway start \
  --search-device cpu \
  --search-model "Xenova/all-MiniLM-L6-v2" \
  --search-alpha 0.8

# Use custom config file
toolscript gateway start --config ./my-config.json
```

**Health Endpoint:**

The gateway exposes a health endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "search": {
    "ready": true,
    "semantic": true
  }
}
```

---

### `gateway status`

Check gateway status and get connection information.

```bash
toolscript gateway status [options]
```

**Options:**

```bash
--pid-file <path>   Path to PID file (default: OS temp directory)
```

**Examples:**

```bash
# Check default gateway
toolscript gateway status

# Check with custom PID file
toolscript gateway status --pid-file /tmp/my-gateway.pid
```

---

### `list-servers`

List configured MCP servers.

```bash
toolscript list-servers [options]
```

**Options:**

```bash
--gateway-url <url>   Gateway URL (default: http://localhost:3000)
```

**Environment Variables:**

```bash
TOOLSCRIPT_GATEWAY_URL=http://localhost:3000
```

**Examples:**

```bash
# List servers
toolscript list-servers

# Use custom gateway URL
toolscript list-servers --gateway-url http://localhost:8080
```

---

### `list-tools`

List tools from a specific MCP server.

```bash
toolscript list-tools <server-name> [options]
```

**Arguments:**

- `<server-name>`: Name of the MCP server

**Options:**

```bash
--gateway-url <url>   Gateway URL (default: http://localhost:3000)
```

**Environment Variables:**

```bash
TOOLSCRIPT_GATEWAY_URL=http://localhost:3000
```

**Examples:**

```bash
# List tools from filesystem server
toolscript list-tools filesystem

# Use custom gateway
toolscript list-tools filesystem --gateway-url http://localhost:8080
```

---

### `get-types`

Get TypeScript types for MCP tools.

```bash
toolscript get-types [options]
```

**Options:**

```bash
--filter <filter>     Filter tools (comma-separated)
                      Format: server1,server2__tool1,server3__tool2
--gateway-url <url>   Gateway URL (default: http://localhost:3000)
```

**Environment Variables:**

```bash
TOOLSCRIPT_GATEWAY_URL=http://localhost:3000
```

**Filter Format:**

- `server1` - All tools from server1
- `server1,server2` - All tools from server1 and server2
- `server1__tool1` - Specific tool from server1
- `server1,server2__tool1,server2__tool2` - Mix of servers and specific tools

**Examples:**

```bash
# Get all types
toolscript get-types

# Get types for specific server
toolscript get-types --filter filesystem

# Get types for multiple servers
toolscript get-types --filter filesystem,github

# Get types for specific tools
toolscript get-types --filter filesystem__readFile,github__createIssue
```

---

### `search`

Search for MCP tools using semantic and fuzzy matching.

```bash
toolscript search <query> [options]
```

**Arguments:**

- `<query>`: Natural language search query

**Options:**

```bash
--limit <number>          Maximum number of results (default: 3)
--threshold <number>      Minimum confidence threshold 0-1 (default: 0.35)
--output <format>         Output format: table, types (default: "table")
--gateway-url <url>       Gateway URL (default: http://localhost:3000)
```

**Environment Variables:**

```bash
TOOLSCRIPT_GATEWAY_URL=http://localhost:3000
TOOLSCRIPT_LIMIT=3
TOOLSCRIPT_THRESHOLD=0.35
```

**Output Formats:**

- `table`: Human-readable table with confidence scores
- `types`: TypeScript types for matched tools

**Examples:**

```bash
# Basic search
toolscript search "read a file"

# Limit results
toolscript search "text manipulation" --limit 5

# Adjust confidence threshold
toolscript search "database operations" --threshold 0.5

# Get TypeScript types for results
toolscript search "git operations" --output types

# Use custom gateway
toolscript search "search query" --gateway-url http://localhost:8080
```

**Search Algorithm:**

The search command uses hybrid search combining:

1. **Semantic search** (70% weight by default): Vector similarity using embedding models
2. **Fuzzy search** (30% weight by default): Keyword-based matching with typo tolerance

Results are ranked by combined score and filtered by threshold.

**Search Stats:**

Check search engine statistics:

```bash
curl http://localhost:3000/search/stats
```

Response:

```json
{
  "toolsIndexed": 42,
  "cachedEmbeddings": 42,
  "model": "Xenova/bge-small-en-v1.5",
  "semanticAvailable": true,
  "cacheHitRate": 1.0
}
```

---

### `exec`

Execute TypeScript code with MCP tool access.

```bash
toolscript exec [code] [options]
```

**Arguments:**

- `[code]`: TypeScript code to execute (if not using --file)

**Options:**

```bash
--file <path>         Execute code from file instead of inline
--gateway-url <url>   Gateway URL (default: http://localhost:3000)
```

**Environment Variables:**

```bash
TOOLSCRIPT_GATEWAY_URL=http://localhost:3000
```

**Examples:**

```bash
# Execute inline code
toolscript exec 'console.log("Hello, world!")'

# Execute code with tool access
toolscript exec 'import { tools } from "toolscript"; console.log(await tools.filesystem.readFile({ path: "/tmp/file.txt" }))'

# Execute from file
toolscript exec --file script.ts

# Use custom gateway
toolscript exec --file script.ts --gateway-url http://localhost:8080
```

**Sandbox Permissions:**

Executed code runs in a Deno sandbox with:

- Network access limited to gateway URL only
- No file system access
- No environment variable access (except `TOOLSCRIPT_GATEWAY_URL`)
- No subprocess spawning

---

## Configuration File

Create `.toolscript.json` in your project root:

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
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

**Server Types:**

- `stdio`: Command-line MCP servers (stdin/stdout communication)
- `http`: HTTP-based MCP servers
- `sse`: Server-Sent Events based MCP servers

**Environment Variables:**

Use `${VAR}` or `${VAR:-default}` syntax for environment variable substitution:

```json
{
  "env": {
    "API_KEY": "${API_KEY}",
    "BASE_URL": "${BASE_URL:-https://api.example.com}"
  }
}
```

---

## Gateway API Endpoints

When running, the gateway exposes these HTTP endpoints:

### `GET /health`

Health check with search status.

**Response:**

```json
{
  "status": "ok",
  "search": {
    "ready": true,
    "semantic": true
  }
}
```

### `GET /servers`

List connected MCP servers.

**Response:**

```json
{
  "servers": ["filesystem", "github"]
}
```

### `GET /tools/:serverName`

List tools from a specific server.

**Response:**

```json
{
  "tools": [
    {
      "name": "readFile",
      "description": "Read a file from disk",
      "inputSchema": { ... }
    }
  ]
}
```

### `POST /call/:serverName/:toolName`

Call a tool on a specific server.

**Request Body:**

```json
{
  "params": {
    "path": "/tmp/file.txt"
  }
}
```

**Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "File contents here"
    }
  ]
}
```

### `GET /runtime/tools.ts`

Get TypeScript client module for all tools.

**Query Parameters:**

- `filter`: Comma-separated server/tool filter (optional)

**Response:**

TypeScript module with generated types and client functions.

### `GET /search?q=<query>`

Search for tools.

**Query Parameters:**

- `q`: Search query (required)
- `limit`: Maximum results (default: 3)
- `threshold`: Minimum score (default: 0.35)

**Response:**

```json
{
  "results": [
    {
      "tool": {
        "serverName": "filesystem",
        "toolName": "readFile",
        "description": "Read a file from disk"
      },
      "score": 0.95,
      "scoreBreakdown": {
        "semantic": 0.92,
        "fuzzy": 0.85,
        "combined": 0.95
      },
      "reason": "semantic match, strong keyword match"
    }
  ]
}
```

### `GET /search/stats`

Get search engine statistics.

**Response:**

```json
{
  "toolsIndexed": 42,
  "cachedEmbeddings": 42,
  "model": "Xenova/bge-small-en-v1.5",
  "semanticAvailable": true,
  "cacheHitRate": 1.0
}
```

---

## Common Workflows

### Development Workflow

```bash
# 1. Start gateway in one terminal
toolscript gateway start

# 2. In another terminal, explore tools
toolscript list-servers
toolscript list-tools filesystem

# 3. Search for tools
toolscript search "read files"

# 4. Get types for development
toolscript get-types --filter filesystem > types.ts

# 5. Write and test code
toolscript exec --file my-script.ts
```

### CI/CD Workflow

```bash
# Start gateway in background
toolscript gateway start &
GATEWAY_PID=$!

# Wait for gateway to be ready
while ! curl -s http://localhost:3000/health > /dev/null; do
  sleep 0.1
done

# Run your toolscripts
toolscript exec --file build-script.ts

# Cleanup
kill $GATEWAY_PID
```

### Claude Code Integration

When installed as a Claude Code plugin, toolscript automatically:

1. Starts gateway on session start
2. Exports `TOOLSCRIPT_GATEWAY_URL` environment variable
3. Stops gateway on session end

No manual gateway management needed!

---

## Troubleshooting

### Gateway won't start

Check if port is already in use:

```bash
lsof -i :3000
```

Use a different port:

```bash
toolscript gateway start --port 8080
```

### Search not working

Check search status:

```bash
curl http://localhost:3000/health
```

If `search.ready` is `false`, check gateway logs for model download issues.

### Tool calls failing

Verify server connection:

```bash
toolscript list-servers
toolscript list-tools <server-name>
```

Check MCP server logs for errors.

### Type generation errors

Get types and check for errors:

```bash
toolscript get-types --filter <server-name> 2>&1
```

Verify tool schemas are valid JSON Schema.

---

## Performance Tips

### Semantic Search Performance

- **CPU mode**: Slower but works everywhere
  ```bash
  toolscript gateway start --search-device cpu
  ```

- **GPU mode**: Faster on supported platforms (Windows, Linux x64)
  ```bash
  toolscript gateway start --search-device gpu
  ```

- **Cache**: Keep enabled for faster repeated searches (default)
  ```bash
  toolscript gateway start  # Cache enabled by default
  ```

### Gateway Startup

- First run: May take 30-60 seconds to download embedding model
- Subsequent runs: Fast startup using cached model
- Cache location: OS temp directory by default

### Search Quality

- Adjust `--search-alpha` to balance semantic vs fuzzy:
  - Higher (0.8-1.0): Prefer semantic understanding
  - Lower (0.3-0.5): Prefer exact keyword matches
  - Default (0.7): Balanced

- Adjust `--threshold` to control result quality:
  - Higher (0.5-0.8): Only high-confidence matches
  - Lower (0.2-0.4): More permissive matching
  - Default (0.35): Balanced
