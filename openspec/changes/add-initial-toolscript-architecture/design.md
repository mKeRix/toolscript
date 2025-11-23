# Design Document: Toolscript Architecture

## Context

Toolscript is a Deno-based CLI tool and Claude Code plugin for implementing MCP code mode. It enables LLMs to write TypeScript code that calls MCP tools, providing better composability, type safety, and token efficiency compared to traditional tool-calling approaches.

### Background

Research into existing implementations reveals several approaches:
- **lootbox** (Deno): Server-first design with WebSocket RPC, persistent workers, good type generation
- **pctx** (Rust/Deno): Gateway pattern with sandbox isolation, security-focused
- **mcp-server-code-execution-mode** (Python): Discovery-first architecture to minimize context, containerized execution
- **Cloudflare Code Mode**: V8 isolates, platform-specific

### Stakeholders
- LLM agents (Claude) writing toolscripts
- Developers configuring MCP servers
- Claude Code users wanting MCP integration

## Goals / Non-Goals

### Goals
1. **Developer Experience**: Simple CLI, automatic type generation, seamless Claude integration
2. **Security**: Sandboxed execution with minimal permissions
3. **Composability**: Enable complex multi-step workflows in single scripts
4. **Token Efficiency**: Reduce context overhead compared to exposing 100+ individual tools
5. **Standard Tooling**: Use Deno ecosystem (JSR, openapi-typescript)

### Non-Goals
- Being an MCP server itself (it's a CLI that connects to servers)
- Supporting runtime languages other than TypeScript initially
- Providing a web UI (CLI-first)
- Container-based isolation (using Deno's permission model instead)

## Decisions

### 1. CLI Tool vs MCP Server

**Decision**: Build as a CLI tool, not an MCP server.

**Rationale**:
- Can be piped with shell commands
- Simpler deployment (no server management for users)
- Better fit for Claude plugin model (skills invoke CLI)
- Gateway server is internal implementation detail

**Alternatives Considered**:
- MCP server exposing single `run_toolscript` tool: Requires users to configure another server, doesn't support shell piping

### 2. Gateway Server Architecture

**Decision**: Long-running HTTP MCP gateway that aggregates configured servers and runs for the entire Claude Code session.

**Rationale**:
- Centralizes MCP connections (persistent, warm)
- Isolates network permissions to single endpoint
- Enables connection reuse across toolscript invocations
- Simplifies type generation (single endpoint to query)
- No startup latency for toolscript execution

**Alternatives Considered**:
- Direct connections from each toolscript: Requires broader network permissions, cold start overhead
- No gateway (CLI connects directly): Doesn't support sandboxed execution with network restrictions
- Lazy gateway start: Adds complexity and latency to first toolscript execution

**Implementation Details**:
- SessionStart hook starts gateway in background and writes PID file containing only process ID
- SessionEnd hook reads PID file and kills the gateway process
- CLI gateway start command runs the server until process is stopped (no gateway stop command)
- To stop a manually started gateway: stop the process (Ctrl+C, kill, etc.)
- Random port allocation handled by SessionStart hook (or CLI --port parameter with default)
- Gateway URL discovery via TOOLSCRIPT_GATEWAY_URL environment variable (full URL with protocol and port)
- PID file contains only the process ID, no port or URL information
- All configured servers connect at gateway startup
- Gateway runs until terminated (SIGTERM, SIGINT, SIGKILL)
- If gateway crashes, it crashes - no automated restart or recovery
- Gateway supports query parameter filtering for /runtime/tools.ts endpoint (?server=name&tool=name)

### 3. Type Generation and HTTP Import Strategy

**Decision**: Pre-generate all types at gateway startup using json-schema-to-typescript with in-memory cache, serve via HTTP endpoint for Deno HTTP imports, and use Deno import maps for clean import syntax.

**Rationale**:
- MCP tool schemas use JSON Schema format
- json-schema-to-typescript is mature, handles complex schemas (enums, unions, conditionals)
- Generated types provide compile-time safety with JSDoc comments from descriptions
- Zero runtime overhead
- No latency during toolscript execution
- In-memory cache is simpler and instance-scoped by default
- HTTP import leverages Deno's native capability, no file mounting needed
- Types always in sync with gateway state
- Simpler architecture than pre-generating and mounting files
- Import maps enable clean `import { tools } from "toolscript"` syntax instead of `import { tools } from "http://localhost:3000/runtime/tools.ts"`

**Alternatives Considered**:
- Runtime type checking only: Misses compile-time errors
- Manual type definitions: Not scalable, gets stale
- ts-morph AST manipulation (lootbox approach): More complex, reinventing json-schema-to-typescript
- openapi-typescript: Designed for OpenAPI, not JSON Schema (MCP uses JSON Schema)
- On-demand generation: Adds latency to first use of each tool
- File-based cache: More complex, conflicts with in-memory approach
- Pre-generate and mount files: Requires file system mounting, more complex than HTTP import
- No import map (raw HTTP URLs): Verbose, exposes implementation details to LLMs

**Implementation Details**:
1. Gateway startup fetches all tool schemas from configured servers
2. Validate and convert server/tool names to valid JavaScript identifiers following TypeScript conventions:
   - snake_case → camelCase for functions: `create_issue` → `createIssue`
   - hyphens → camelCase for functions: `get-user-profile` → `getUserProfile`
   - snake_case → camelCase for namespaces: `my_server` → `myServer`
   - hyphens → camelCase for namespaces: `github-api` → `githubApi`
   - PascalCase for types combining server + tool: `GithubCreateIssueParams`
   - Prefix numbers with underscore: `123test` → `_123test`
   - Collapse multiple underscores/hyphens: `create__issue` → `createIssue`
   - Remove invalid characters (not alphanumeric/underscore)
3. Convert MCP InputSchema to OpenAPI 3.0 schema
4. Run openapi-typescript to generate TypeScript definitions
5. Generate client code with TypeScript naming conventions:
   - Function names: camelCase (e.g., createIssue, getUserProfile)
   - Type names: PascalCase (e.g., GithubCreateIssueParams, GithubCreateIssueResult)
   - Namespace objects: camelCase (e.g., tools.github, tools.atlassian, tools.myApiServer)
6. Serve module via HTTP endpoint at `/runtime/tools.ts` with optional query parameter filtering
   - ?server=github - returns only github tools
   - ?server=github&tool=createIssue - returns only that specific tool
   - No params - returns all tools from all servers
7. Cache generated module in memory (instance-scoped)
8. Regenerate cache when servers reconnect or tools change
9. Return with Content-Type: application/typescript
10. No metadata injection in execution environment
11. When executing toolscripts, generate import map JSON dynamically:
    - Map `"toolscript"` to `"${TOOLSCRIPT_GATEWAY_URL}/runtime/tools.ts?_t=${timestamp}"`
    - Cache busting via _t timestamp parameter ensures fresh types
    - Write import map to temporary file
    - Launch Deno with `--import-map=<path>` flag
    - LLMs use clean import: `import { tools } from "toolscript"`

### 4. Execution Sandbox Model

**Decision**: Use Deno's permission system with network-only access to gateway server.

**Rationale**:
- Lightweight (no containers)
- Deno-native security model
- Fine-grained permission control
- Fast startup (no container overhead)

**Alternatives Considered**:
- Docker/Podman containers: Heavy, complex setup, slower
- No sandboxing: Insecure for LLM-generated code
- Deno Workers: Limited API access, harder to inject client

**Security Constraints**:
```bash
# Toolscript execution permissions
deno run \
  --allow-net=localhost:PORT \  # Only gateway server
  --import-map=/tmp/import-map.json \  # Import map for clean imports
  --no-prompt \                  # No interactive prompts
  toolscript.ts
```

**Environment**:
- `TOOLSCRIPT_GATEWAY_URL`: Gateway full URL (protocol, host, port) for HTTP imports
- Toolscript imports via clean syntax: `import { tools } from "toolscript"`
- Deno resolves `"toolscript"` → `${TOOLSCRIPT_GATEWAY_URL}/runtime/tools.ts?_t=${timestamp}` via import map
- Cache busting via _t timestamp parameter ensures fresh types on gateway restart
- Top-level await supported

**Import Map Structure**:
```json
{
  "imports": {
    "toolscript": "http://localhost:3000/runtime/tools.ts?_t=1234567890"
  }
}
```

### 5. Configuration Format

**Decision**: Single JSON config file at `./.toolscript.json` mirroring Claude Code's MCP server configuration format.

**Rationale**:
- Matches Claude Code's familiar configuration format
- Simple to understand and edit
- Supports multi-server configurations with stdio, HTTP, and SSE types
- Can be version-controlled
- Gateway config (port, etc.) handled via CLI params/env vars
- Environment variable expansion with ${VAR} and ${VAR:-default} syntax

**Alternatives Considered**:
- Multiple config files: Adds complexity, not needed for initial version
- Environment variables: Not scalable for multiple servers
- Discovery from Claude config: Tight coupling, fragile
- TOML format: JSON is simpler and more widely supported
- Custom format: Better to match Claude Code's proven format

**Schema** (matching Claude Code):
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
    "api-server": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN:-default_token}"
      }
    }
  }
}
```

### 6. Client Code Generation and HTTP Serving

**Decision**: Auto-generate client code and serve via HTTP endpoint, using TypeScript naming conventions.

**Rationale**:
- Prevents LLM from trying to modify plumbing
- Ensures type-safe invocations
- Reduces cognitive load (LLM just imports and uses)
- HTTP serving simpler than file mounting
- Types always in sync with gateway
- TypeScript naming conventions provide familiar, idiomatic API

**Alternatives Considered**:
- LLM writes HTTP requests: Verbose, error-prone, loses type safety
- Provide runtime helper functions: Still requires LLM to know protocol details
- File-based mounting: More complex than HTTP import

**Generated Client Structure** (TypeScript naming conventions):
```typescript
// Served via HTTP at /runtime/tools.ts (supports filtering via query params)
// Auto-generated, uses TypeScript naming conventions
// LLMs import via: import { tools } from "toolscript"

interface GithubCreateIssueParams {
  title: string;
  body?: string;
  labels?: string[];
}

interface GithubCreateIssueResult {
  id: number;
  url: string;
}

interface AtlassianGetIssueParams {
  issueKey: string;
}

interface AtlassianGetIssueResult {
  id: string;
  fields: Record<string, unknown>;
}

export const tools = {
  github: {
    async createIssue(
      params: GithubCreateIssueParams
    ): Promise<GithubCreateIssueResult> {
      const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
      const response = await fetch(`${url}/tools/github__create_issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return await response.json();
    }
  },
  atlassian: {
    async getIssue(
      params: AtlassianGetIssueParams
    ): Promise<AtlassianGetIssueResult> {
      const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
      const response = await fetch(`${url}/tools/atlassian__get_issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return await response.json();
    }
  }
};
```

**LLM Usage Example**:
```typescript
// LLMs write toolscripts with clean import syntax
import { tools } from "toolscript";

const issue = await tools.github.createIssue({
  title: "Bug report",
  body: "Description here",
  labels: ["bug"]
});

console.log(`Created issue: ${issue.url}`);
```

**TypeScript Naming Conversion Examples**:
- Server: `github`, Tool: `create_issue` → Function: `tools.github.createIssue()`, Types: `GithubCreateIssueParams`, `GithubCreateIssueResult`
- Server: `my-api-server`, Tool: `get_user_profile` → Function: `tools.myApiServer.getUserProfile()`, Types: `MyApiServerGetUserProfileParams`, `MyApiServerGetUserProfileResult`
- Server: `my_server`, Tool: `create-issue` → Function: `tools.myServer.createIssue()`, Types: `MyServerCreateIssueParams`, `MyServerCreateIssueResult`
- Edge case: `123server`, `create__issue` → Function: `tools._123server.createIssue()` (leading number prefixed, multiple underscores collapsed)

### 7. Claude Plugin Design

**Decision**: Single skill using progressive disclosure + Hooks for lifecycle management. Plugin lives in marketplace structure under `plugins/toolscript/`.

**Plugin Structure**:
```
plugins/toolscript/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   └── toolscript/
│       ├── SKILL.md             # Lean skill with references/ for detailed content
│       └── references/          # Progressive disclosure content
└── hooks/
    ├── hooks.json               # Hook registration
    ├── session-start.sh         # Start gateway in background
    └── session-end.sh           # Kill gateway process on session end
```

**Skills**:
- `toolscript`: Lean skill with references/ for detailed content (progressive disclosure pattern)
  - Location: `plugins/toolscript/skills/toolscript/SKILL.md`

**Hooks**:
- `SessionStart`: Start gateway in background, allocate random port, write PID file (process ID only), write TOOLSCRIPT_GATEWAY_URL (full URL with protocol and port) to environment
  - Location: `plugins/toolscript/hooks/session-start.sh`
  - Runs `toolscript gateway start` in background and manages the background process
- `SessionEnd`: Read PID file, kill gateway process, cleanup PID file
  - Location: `plugins/toolscript/hooks/session-end.sh`
  - Kills the process via PID file (no stop command)

**Rationale**:
- Progressive disclosure reduces LLM context overhead
- Hooks ensure gateway lifecycle matches Claude session
- SessionStart hook handles background process management and PID file creation
- SessionEnd hook handles process termination via kill command
- CLI gateway start command just runs the server (no stop command)
- Manual gateway stop: user stops the process (Ctrl+C, kill, etc.)
- Hooks manage background lifecycle, CLI manages foreground execution
- Skills do not attempt to launch gateway themselves
- If gateway crashes, skill reports unhealthy status without automated restart
- Logging goes to stdout/stderr (no "plugin logs" concept in Claude Code)
- Marketplace structure separates plugin from CLI tool source code
- Repository contains both the CLI tool (src/) AND the Claude plugin (plugins/toolscript/)

**Alternatives Considered**:
- Manual gateway management: Error-prone, leaves processes running
- Multiple skills: Adds complexity, single skill with progressive disclosure is cleaner
- Gateway manages PID: SessionStart/SessionEnd hooks are better positioned to manage lifecycle
- CLI stop command: Unnecessary complexity, hooks manage background lifecycle
- Automated crash recovery: Adds complexity, let it crash is simpler
- Flat plugin structure: Marketplace structure allows future plugins to be added

### 8. Development Tooling

**Decision**: Use Deno's built-in development tools instead of adding external tooling dependencies.

**Rationale**:
- Deno includes `deno fmt` (Prettier equivalent), `deno lint` (ESLint equivalent), and `deno test` (Jest/Mocha equivalent)
- No additional dependencies reduces installation complexity
- Single configuration file (`deno.json`) for all tooling
- Consistent formatting/linting across all Deno projects
- Built-in tools are optimized for Deno's TypeScript runtime
- Faster tooling execution (native implementation)

**Alternatives Considered**:
- ESLint + Prettier: Adds dependencies, requires separate configs, slower than Deno built-ins
- Jest/Mocha: Not designed for Deno, requires compatibility layers

**Implementation Details**:
- Configure `deno.json` with `fmt`, `lint`, and `test` sections
- `fmt`: Set line width to 100, 2-space indent, semicolons, double quotes
- `lint`: Enable recommended rules by default
- `test`: Include `tests/` directory, use `*.test.ts` pattern
- CI pipeline runs: `deno fmt --check && deno lint && deno test`

### 9. Optional Configuration File

**Decision**: Allow gateway to launch successfully even when no `.toolscript.json` configuration file exists.

**Rationale**:
- Enables Claude plugin to work in any directory without setup
- Reduces friction for users exploring toolscript
- Skill can inform users about configuration after they try it
- Gateway serves empty tools module (`export const tools = {}`) when no config
- All CLI commands handle missing config gracefully
- SessionStart hook succeeds without errors

**Alternatives Considered**:
- Require config file: Creates friction, makes plugin fail in directories without setup
- Auto-create default config: Too opinionated, may surprise users
- Fail with helpful error: Still blocks usage, optional config is more flexible

**Implementation Details**:
- Config loader returns empty server list when no file exists
- Gateway starts with zero servers connected
- Type generator produces: `export const tools = {}`
- HTTP endpoint `/runtime/tools.ts` serves empty module
- CLI commands:
  - `list-servers`: Returns empty list
  - `list-tools <server>`: Returns "Server not found" error
  - `get-types <server>`: Returns "Server not found" error
  - `exec <code>`: Works with empty tools object
- SessionStart hook starts gateway without error
- Skill informs user they can create `.toolscript.json` to add servers

## Risks / Trade-offs

### Risk: Deno Permission Model Complexity
**Mitigation**: Document clearly, provide examples, start with minimal permissions

### Risk: Type Generation Performance
**Mitigation**: Cache generated types, only regenerate on schema changes

### Risk: Gateway Process Management
**Mitigation**: Robust PID file tracking, session_id association, graceful shutdown on SessionEnd

### Trade-off: No Container Isolation
**Acceptance**: Deno permissions provide sufficient sandboxing for this use case. Users running truly untrusted code should use additional isolation.

### Trade-off: HTTP vs Stdio for Gateway
**Decision**: HTTP for simplicity, future can add stdio mode
**Rationale**: HTTP is easier to debug, widely supported, and sufficient for local gateway

## Migration Plan

N/A (new project, no migration needed)

## Resolved Design Decisions

1. **Config file format**: JSON only at `./.toolscript.json`
   - Simple, widely supported, no multi-level merging complexity

2. **JSR publishing strategy**: Single package with both CLI and plugin
   - Simpler for users, single installation

3. **Type cache strategy**: In-memory only
   - Cache lifetime matches gateway instance
   - No file-based cache
   - Simpler and instance-scoped by default

4. **Gateway instances**: Single instance per Claude Code session
   - SessionStart/SessionEnd hooks manage lifecycle
   - PID file tracks process

5. **Tool namespacing**: Use `__` separator (e.g., `github__create_issue`)
   - Clear, readable, standard convention

6. **Core libraries**:
   - HTTP routing: Hono (lightweight, fast, Deno-native)
   - CLI framework: cliffy (Deno-native, mature, includes table formatting)
   - Logging: logtape (zero dependencies, Deno-native)
   - MCP SDK: @modelcontextprotocol/sdk (official TypeScript SDK)
   - Type generation: json-schema-to-typescript (handles JSON Schema, not OpenAPI)
   - Validation: zod (for MCP server tool schemas)

7. **Development tooling**:
   - Formatting: Deno's built-in `deno fmt` (no Prettier needed)
   - Linting: Deno's built-in `deno lint` (no ESLint needed)
   - Testing: Deno's built-in `deno test` (no Jest/Mocha needed)
   - Configuration: `deno.json` for all tooling settings

8. **Optional configuration file**:
   - Gateway launches successfully without `.toolscript.json`
   - Serves empty tools module when no config exists
   - Allows plugin to work in any directory without setup
