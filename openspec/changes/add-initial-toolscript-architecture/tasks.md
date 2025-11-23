# Implementation Tasks

## 1. Project Setup

- [x] 1.1 Initialize Deno project with deno.json
- [x] 1.2 Configure TypeScript compiler options for strict mode
- [x] 1.3 Set up project dependencies (hono for HTTP routing, cliffy for CLI, logtape for logging, @modelcontextprotocol/sdk, json-schema-to-typescript)
- [x] 1.4 Create directory structure
- [x] 1.5 Configure deno.json with fmt settings (lineWidth: 100, indentWidth: 2, semiColons: true)
- [x] 1.6 Configure deno.json with lint settings (rules: recommended)
- [x] 1.7 Configure deno.json with test settings (include: tests/)
- [x] 1.8 Set up .gitignore

## 2. Configuration System

- [x] 2.1 Define MCP server configuration schema with Zod matching Claude Code format
- [x] 2.2 Implement config file loading from ./.toolscript.json (or --config path)
- [x] 2.3 Handle missing config file gracefully - return empty server list without error
- [x] 2.4 Implement config validation with mcpServers format (type, command, args, url, headers, env)
- [x] 2.5 Add environment variable substitution with ${VAR} and ${VAR:-default} syntax
- [x] 2.6 Support stdio, http, and sse server types
- [x] 2.7 Create example configuration file matching Claude Code format

## 3. Gateway Server

- [x] 3.1 Implement HTTP MCP server using @modelcontextprotocol/sdk
- [x] 3.2 Implement eager MCP client connections to all configured servers at startup
- [x] 3.3 Handle zero servers configured - start gateway successfully with empty server list
- [x] 3.4 Implement server aggregation with double-underscore namespacing (e.g., github__create_issue)
- [x] 3.5 Add tool listing endpoint (returns empty list when no servers)
- [x] 3.6 Add tool execution endpoint
- [x] 3.7 Add HTTP endpoint /runtime/tools.ts that serves generated TypeScript module with Content-Type: application/typescript
- [x] 3.8 Implement query parameter filtering for /runtime/tools.ts (?server=name&tool=name)
- [x] 3.9 Implement in-memory caching of generated tools module
- [x] 3.10 Generate empty tools module when no servers configured: export const tools = {}
- [x] 3.11 Regenerate module cache when servers reconnect or tools change
- [x] 3.12 Add health check endpoint
- [x] 3.13 Implement CLI --port parameter (default to random port)
- [x] 3.14 Gateway runs until process termination (SIGTERM, SIGINT, SIGKILL)
- [x] 3.15 Add logging to stdout/stderr using logtape

## 4. Type Generation

- [x] 4.1 Implement TypeScript naming convention conversion:
  - [ ] 4.1.1 snake_case → camelCase for functions (create_issue → createIssue)
  - [ ] 4.1.2 hyphens → camelCase for functions (get-user-profile → getUserProfile)
  - [ ] 4.1.3 snake_case → camelCase for namespaces (my_server → myServer)
  - [ ] 4.1.4 hyphens → camelCase for namespaces (github-api → githubApi)
  - [ ] 4.1.5 PascalCase for types combining server + tool (GithubCreateIssueParams)
  - [ ] 4.1.6 Preserve existing camelCase identifiers
  - [ ] 4.1.7 Prefix numbers with underscore (123test → _123test)
  - [ ] 4.1.8 Collapse multiple underscores/hyphens (create__issue → createIssue)
  - [ ] 4.1.9 Remove invalid characters (not alphanumeric/underscore)
- [x] 4.2 Implement MCP schema to OpenAPI conversion
- [x] 4.3 Integrate openapi-typescript for type generation
- [x] 4.4 Pre-generate all types at gateway startup
- [x] 4.5 Implement in-memory type caching only (no file-based cache)
- [x] 4.6 Generate client code with TypeScript naming conventions (camelCase functions, PascalCase types, camelCase namespaces)
- [x] 4.7 Generate tools module for HTTP serving with proper TypeScript types
- [x] 4.8 Implement module filtering by server and tool query parameters
- [x] 4.9 Generate empty tools module when no servers configured: export const tools = {}
- [x] 4.10 Ensure no metadata injection in execution environment
- [x] 4.11 Update type generation to serve module accessible via clean import syntax (import { tools } from "toolscript")

## 5. CLI Commands

- [x] 5.1 Implement CLI argument parsing using cliffy
- [x] 5.2 Implement `list-servers` command (returns empty list when no config)
- [x] 5.3 Implement `list-tools <server>` command (returns "Server not found" when no config)
- [x] 5.4 Implement `get-types <server> [tool]` command that fetches from gateway HTTP endpoint /runtime/tools.ts with query parameters (returns "Server not found" when no config)
- [x] 5.5 Use query parameters for filtering types (?server=name&tool=name)
- [x] 5.6 Format types output as Markdown with clean import examples (import { tools } from "toolscript")
- [x] 5.7 Implement `exec <code>` command for inline toolscripts (works with empty tools when no config)
- [x] 5.8 Implement `exec <file>` command for file-based toolscripts (works with empty tools when no config)
- [x] 5.9 Implement `gateway start --port <port>` command that runs until process is stopped (starts with zero servers when no config)
- [x] 5.10 Implement `gateway status` command
- [x] 5.11 Add `--help` output for all commands
- [x] 5.12 Add `--version` flag
- [x] 5.13 Add `--config` flag to specify config file path

## 6. Toolscript Execution

- [x] 6.1 Implement Deno sandbox configuration
- [x] 6.2 Configure network permissions (only gateway server access via --allow-net=localhost:PORT)
- [x] 6.3 Implement runtime environment setup with TOOLSCRIPT_GATEWAY_URL (full URL with protocol and port)
- [x] 6.4 Generate import map JSON dynamically with URL from TOOLSCRIPT_GATEWAY_URL mapping "toolscript" to gateway HTTP URL
- [x] 6.5 Add cache busting to import map URL with timestamp parameter (?_t=${timestamp})
- [x] 6.6 Write import map to temporary file for Deno to consume
- [x] 6.7 Launch Deno with --import-map flag pointing to generated import map file
- [x] 6.8 Enable clean import syntax (import { tools } from "toolscript") via import map resolution
- [x] 6.9 Implement stdout/stderr handling (return → stdout, console.log → stdout, console.error → stderr)
- [x] 6.10 Add error handling and reporting
- [x] 6.11 Implement top-level await support
- [x] 6.12 Ensure no metadata injection in execution environment

## 7. Claude Plugin Integration

- [x] 7.1 Create plugin directory structure at `plugins/toolscript/`
- [x] 7.2 Create plugin manifest at `plugins/toolscript/.claude-plugin/plugin.json`
- [x] 7.3 Create single `toolscript` skill at `plugins/toolscript/skills/toolscript/SKILL.md` using progressive disclosure pattern
- [x] 7.4 Create references/ directory at `plugins/toolscript/skills/toolscript/references/` with detailed skill content
- [x] 7.5 Create hooks.json at `plugins/toolscript/hooks/hooks.json` for hook registration
- [x] 7.6 Implement SessionStart hook at `plugins/toolscript/hooks/session-start.sh` to start gateway in background, allocate port, write PID file (process ID only)
- [x] 7.7 SessionStart hook handles missing config file gracefully - starts gateway with zero servers
- [x] 7.8 SessionStart hook writes TOOLSCRIPT_GATEWAY_URL (full URL with protocol and port) to environment variable
- [x] 7.9 Implement SessionEnd hook at `plugins/toolscript/hooks/session-end.sh` to read PID file and kill gateway process
- [x] 7.10 Skill reports unhealthy gateway status without attempting restart on crash
- [x] 7.11 Ensure skill does not try to launch gateway itself
- [x] 7.12 Skill informs user they can create .toolscript.json when no config exists
- [x] 7.13 Add skill documentation and examples following progressive disclosure

## 8. Security

- [x] 8.1 Implement Deno permission restrictions
- [x] 8.2 Configure network-only access to gateway
- [x] 8.3 Add sandbox environment variable restrictions
- [x] 8.4 Implement secure temp file handling
- [x] 8.5 Add security documentation

## 9. Testing

- [ ] 9.1 Set up test framework
- [ ] 9.2 Add unit tests for config loading
- [ ] 9.3 Add unit tests for type generation
- [ ] 9.4 Add integration tests for gateway server
- [ ] 9.5 Add integration tests for toolscript execution
- [ ] 9.6 Add end-to-end tests for CLI commands
- [ ] 9.7 Test Claude plugin integration

## 10. Documentation

- [x] 10.1 Write README.md with quick start guide
- [x] 10.2 Write architecture documentation
- [x] 10.3 Write security model documentation
- [x] 10.4 Create example toolscripts
- [x] 10.5 Document configuration options
- [x] 10.6 Document CLI commands
- [x] 10.7 Add troubleshooting guide

## 11. Packaging

- [ ] 11.1 Configure deno compile task
- [ ] 11.2 Create install script
- [ ] 11.3 Publish to JSR
- [ ] 11.4 Test installation via `deno install`
- [ ] 11.5 Create release workflow

## 12. Development Tooling and CI

- [x] 12.1 Verify deno.json fmt configuration (lineWidth: 100, indentWidth: 2, semiColons: true)
- [x] 12.2 Verify deno.json lint configuration (recommended rules)
- [x] 12.3 Verify deno.json test configuration (include: tests/)
- [x] 12.4 Set up CI pipeline to run deno fmt --check
- [x] 12.5 Set up CI pipeline to run deno lint
- [x] 12.6 Set up CI pipeline to run deno test
- [x] 12.7 Add pre-commit hook script (optional) for formatting and linting
- [x] 12.8 Document development tooling in README.md
