# Project Context

## Purpose

Toolscript is a Deno-native CLI tool and Claude Code plugin for implementing MCP (Model Context Protocol) code mode. It enables LLMs to write TypeScript code that calls MCP tools, providing better composability, type safety, and token efficiency compared to traditional sequential tool-calling approaches.

### Key Value Propositions
- **Code-First MCP**: LLMs write real TypeScript instead of using tool invocation syntax
- **Token Efficiency**: Reduce context overhead by enabling multi-step workflows in single scripts
- **Type Safety**: Automatic TypeScript type generation from MCP schemas via openapi-typescript
- **Security**: Sandboxed execution using Deno's permission model
- **Composability**: Chain multiple MCP tools with custom logic and data transformations

## Tech Stack

### Runtime & Language
- **Deno 2.x**: TypeScript/JavaScript runtime with built-in security and tooling
- **TypeScript**: Strict mode for type safety throughout codebase

### Core Dependencies
- **@hono/hono**: Lightweight HTTP server framework for gateway routing
- **@cliffy/command**: CLI framework for argument parsing and commands
- **@cliffy/table**: Table formatting for CLI output
- **@logtape/logtape**: Zero-dependency structured logging library
- **@modelcontextprotocol/sdk**: Official MCP SDK for client connections
- **json-schema-to-typescript**: Generate TypeScript types from JSON Schema
- **zod**: Runtime type validation and schema definition for MCP servers

### Distribution
- **JSR (JavaScript Registry)**: Primary package distribution
- **deno compile**: Standalone binary compilation for easy installation

## Project Conventions

### Code Style
- **Formatting**: Use `deno fmt` with default settings (2-space indent, semicolons, double quotes)
- **Linting**: Use `deno lint` with recommended rules
- **File naming**: kebab-case for files (e.g., `gateway-server.ts`)
- **Type naming**: PascalCase for types/interfaces, camelCase for variables/functions
- **Strict TypeScript**: All files use strict mode, no implicit any

### Development Tooling
- **Formatting**: Use Deno's built-in `deno fmt` (similar to Prettier)
  - Configuration in `deno.json` under `fmt` key
  - Default settings: 2-space indent, semicolons, double quotes, 100-character line width
- **Linting**: Use Deno's built-in `deno lint` (similar to ESLint)
  - Configuration in `deno.json` under `lint` key
  - Enable recommended rules by default
  - Add custom rules as needed
- **Testing**: Use Deno's built-in `deno test` framework
  - Configuration in `deno.json` under `test` key
  - Test files follow pattern `*.test.ts`
  - Use `@std/assert` for assertions
- **CI Integration**: Run `deno fmt --check`, `deno lint`, and `deno test` in CI pipeline
- **Pre-commit Hooks**: Optional git hooks to run formatting and linting before commits

### Architecture Patterns

#### Separation of Concerns
- **CLI layer**: Argument parsing and command dispatch only
- **Gateway layer**: MCP protocol handling and server aggregation
- **Execution layer**: Sandbox management and toolscript runtime
- **Type generation layer**: Schema conversion and code generation
- **Configuration layer**: Config loading, validation, and merging

#### Dependency Flow
```
CLI → Gateway ← Execution
  ↓      ↓         ↓
Config  Types   Types
```

#### Error Handling
- Use custom error types extending `Error`
- Provide actionable error messages with context
- Log errors appropriately (debug vs user-facing)
- Fail fast on configuration/validation errors
- Graceful degradation for non-critical failures

#### Async Patterns
- Use top-level await where supported
- Prefer `async/await` over `.then()` chains
- Handle promise rejections explicitly
- Use `Promise.all()` for concurrent operations

### Testing Strategy

#### Test Organization
- Unit tests: `src/**/*.test.ts` (co-located with source)
- Integration tests: `tests/integration/*.test.ts`
- E2E tests: `tests/e2e/*.test.ts`

#### Test Framework
- Use Deno's built-in test runner (`deno test`)
- Use `@std/assert` for assertions
- Mock MCP servers for gateway tests
- Mock file system for config tests

#### Coverage Goals
- Core logic: 80%+ coverage
- CLI commands: E2E test for each command
- Error paths: Test error handling explicitly

#### Test Conventions
- One test file per source file for unit tests
- Descriptive test names using "should" pattern
- Setup/teardown in test blocks, not global
- Avoid test interdependencies

#### Special Testing Requirements

**Transformers.js / ONNX Runtime**
- Any code using transformers.js (semantic search) must be tested via E2E tests, not unit tests
- ONNX Runtime creates worker threads and file handles that don't properly close, causing resource leaks
- Unit tests with Deno's resource sanitizers will fail due to these leaks
- E2E tests isolate the issue by running the gateway (with transformers.js) in a separate process
- Example: `SearchEngine` is tested through E2E gateway tests in `tests/e2e/cli.test.ts`
- This is a known limitation of the underlying ONNX Runtime library, not a bug in our code

### Git Workflow

#### Branching Strategy
- `main`: Production-ready code
- Feature branches: `feature/add-<capability>`
- Bugfix branches: `fix/<issue-description>`

#### Commit Conventions
- Use conventional commits format
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Examples:
  - `feat(gateway): add server aggregation`
  - `fix(cli): handle missing config file`
  - `docs: add architecture diagram`

#### Pull Request Process
- Create PR from feature branch to main
- Include tests for new functionality
- Update documentation as needed
- Use OpenSpec workflow for significant changes

## Domain Context

### MCP (Model Context Protocol)
- Protocol for AI assistants to interact with external tools and data sources
- Defines tools, resources, and prompts that servers expose to clients
- Uses JSON-RPC 2.0 over stdio or HTTP transport
- Tool schemas use JSON Schema format for input validation

### Code Mode Pattern
- Alternative to traditional sequential tool calling
- LLM writes code that calls multiple tools with custom logic
- Reduces token overhead (no intermediate context passing)
- Enables complex workflows not possible with single tool calls
- Championed by Anthropic, Cloudflare, Apple Research

### Deno Security Model
- Permission-based sandbox (--allow-net, --allow-read, etc.)
- Granular permissions (e.g., --allow-net=domain:port)
- No file system access by default
- Environment variables isolated
- Secure by default, opt-in to permissions

### TypeScript Type Generation
- MCP tools define JSON Schema for input/output validation
- json-schema-to-typescript generates TypeScript interfaces from JSON Schema
- Types enable compile-time checking and IDE autocomplete
- Zero runtime overhead (types erased after compilation)
- Supports JSDoc comments extracted from schema descriptions

## Important Constraints

### Technical Constraints
- **Deno-only**: Not compatible with Node.js (uses Deno-specific APIs)
- **Local execution**: Gateway runs on localhost, not designed for remote deployment
- **HTTP MCP only initially**: Stdio MCP servers supported, HTTP MCP servers future enhancement
- **TypeScript-only**: No JavaScript support for toolscripts (compilation required)

### Security Constraints
- **Network restrictions**: Toolscripts can only access gateway URL
- **No filesystem access**: Toolscripts cannot read/write files
- **No environment access**: Only TOOLSCRIPT_GATEWAY_URL provided
- **Timeout enforcement**: All toolscripts must complete within timeout period

### Performance Constraints
- **Startup time**: Gateway should start within 2 seconds
- **Type generation**: Should complete within 5 seconds per server
- **Execution overhead**: Sandbox startup should be < 500ms
- **Memory usage**: Gateway should use < 100MB RAM for typical usage

### Compatibility Constraints
- **MCP SDK version**: Track @modelcontextprotocol/sdk releases
- **Deno version**: Requires Deno 2.x or later
- **TypeScript version**: Use version bundled with Deno
- **Claude Code version**: Test with latest Claude Code release

## External Dependencies

### MCP Servers (Examples)
- **@modelcontextprotocol/server-github**: GitHub API integration
- **@modelcontextprotocol/server-filesystem**: Local filesystem access
- **@modelcontextprotocol/server-postgres**: PostgreSQL database queries
- **Custom MCP servers**: User-provided servers following MCP spec

### Deno Standard Library
- **@std/cli**: Command-line argument parsing
- **@std/path**: Path manipulation utilities
- **@std/fs**: File system operations
- **@std/assert**: Testing assertions

### Build & Development Tools
- **deno fmt**: Code formatting
- **deno lint**: Linting
- **deno test**: Test runner
- **deno compile**: Binary compilation

## Design Principles

### Simplicity First
- Default to simple solutions before adding complexity
- Avoid frameworks unless clearly necessary
- Prefer boring, proven patterns over novel approaches
- Keep code readable and maintainable

### Progressive Enhancement
- Core functionality works with minimal configuration
- Advanced features are opt-in
- Graceful degradation when features unavailable
- Clear upgrade paths for users

### Developer Experience
- Fast feedback loops (instant type checking, quick execution)
- Clear error messages with actionable guidance
- Comprehensive documentation with examples
- Minimal configuration required to get started

### Security by Default
- Most restrictive permissions by default
- Explicit opt-in for additional permissions
- Clear documentation of security implications
- Regular security audits of dependencies
