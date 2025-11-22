# Change: Add Initial Toolscript Architecture

## Why

The current landscape of MCP (Model Context Protocol) integration lacks a code-first, Deno-native solution that balances developer experience with security and composability. Existing implementations either:
- Use Python/containers with heavy isolation overhead (elusznik/mcp-server-code-execution-mode)
- Are platform-locked (Cloudflare Code Mode)
- Require complex Rust builds (pctx)
- Mix concerns between server and CLI (lootbox)

We need a lightweight, secure, Deno-native CLI tool that enables LLMs to write TypeScript code calling MCP tools, with automatic type generation, sandboxed execution, and seamless integration into Claude Code workflows through plugins.

## What Changes

This proposal introduces the complete toolscript system:

1. **CLI Tool Architecture**: Deno-based command-line tool (not an MCP server itself) with commands for listing servers, tools, types, and executing toolscripts
2. **Gateway Server**: Long-running HTTP MCP gateway that aggregates configured MCP servers and provides unified access, running for the entire Claude Code session
3. **Toolscript Execution Engine**: Secure, sandboxed TypeScript execution environment with pre-generated types from MCP tool schemas
4. **Configuration System**: Single JSON config file at `./.toolscript.json`
5. **Type Generation Pipeline**: OpenAPI-to-TypeScript conversion using openapi-typescript for compile-time safety, fully pre-generated at gateway startup
6. **Claude Plugin Integration**: Single skill for toolscript operations + hooks for lifecycle management (SessionStart/SessionEnd)
7. **Security Model**: Deno's permission-based sandboxing with selective network access only to gateway server

**Breaking changes**: None (new project)

## Impact

### Affected Specs
- **New capability**: `cli-interface` - Command-line interface and argument parsing
- **New capability**: `gateway-server` - HTTP MCP gateway server with lifecycle management
- **New capability**: `toolscript-execution` - Sandboxed TypeScript execution with MCP tool access
- **New capability**: `type-generation` - Automatic TypeScript type generation from MCP schemas
- **New capability**: `configuration` - Config file structure and discovery
- **New capability**: `claude-plugin` - Claude Code plugin skills and hooks

### Affected Code
- CLI tool source code under `/src`
- Claude plugin under `/plugins/toolscript/`
- Project scaffolding: `deno.json`, `README.md`, `.gitignore`
- Documentation: `/docs`

### Project Structure (Claude Plugin Marketplace)
```
toolscript/                             # Repository root - Claude plugin marketplace
├── plugins/                            # Claude plugin marketplace directory
│   └── toolscript/                     # The toolscript plugin
│       ├── .claude-plugin/
│       │   └── plugin.json             # Plugin manifest
│       ├── skills/
│       │   └── toolscript/
│       │       ├── SKILL.md            # Toolscript operations skill
│       │       └── references/         # Progressive disclosure content
│       └── hooks/
│           ├── hooks.json              # Hook registration
│           ├── session-start.sh        # Start gateway in background
│           └── session-end.sh          # Kill gateway process on session end
├── src/                                # CLI tool source code
│   ├── cli/
│   │   ├── main.ts                     # CLI entry point
│   │   ├── commands/
│   │   │   ├── list-servers.ts         # List MCP servers
│   │   │   ├── list-tools.ts           # List tools for server
│   │   │   ├── get-types.ts            # Get types for tool
│   │   │   ├── exec.ts                 # Execute toolscript
│   │   │   └── gateway.ts              # Gateway management commands
│   │   └── args.ts                     # Argument parsing
│   ├── gateway/
│   │   ├── server.ts                   # HTTP MCP gateway server
│   │   ├── mcp-client.ts               # MCP client connections
│   │   ├── aggregator.ts               # Multi-server aggregation
│   │   └── lifecycle.ts                # Start/stop/status management
│   ├── execution/
│   │   ├── sandbox.ts                  # Deno sandbox configuration
│   │   ├── runtime.ts                  # Toolscript runtime environment
│   │   └── client-gen.ts               # Generated client mounting
│   ├── types/
│   │   ├── generator.ts                # Type generation from MCP schemas
│   │   ├── openapi-converter.ts        # MCP to OpenAPI conversion
│   │   └── cache.ts                    # Type cache management
│   ├── config/
│   │   ├── loader.ts                   # Config file discovery and loading
│   │   ├── schema.ts                   # Config validation schema
│   │   └── types.ts                    # Config type definitions
│   └── utils/
│       ├── logger.ts                   # Logging utilities
│       ├── errors.ts                   # Error types
│       └── process.ts                  # Process management
├── deno.json                           # Deno configuration and tasks
├── .toolscript.json                    # Example config
├── README.md
└── docs/
    ├── architecture.md                 # Architecture documentation
    ├── security.md                     # Security model
    └── examples/                       # Example toolscripts
