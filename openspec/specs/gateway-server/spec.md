# gateway-server Specification

## Purpose
TBD - created by archiving change add-initial-toolscript-architecture. Update Purpose after archive.
## Requirements
### Requirement: HTTP MCP Server
The gateway SHALL implement the MCP protocol over HTTP transport.

#### Scenario: Initialize connection
- **WHEN** client sends initialize request
- **THEN** gateway responds with server capabilities and protocol version

#### Scenario: List available tools
- **WHEN** client sends tools/list request
- **THEN** gateway returns aggregated tools from all configured servers

#### Scenario: Execute tool
- **WHEN** client sends tools/call request with valid tool name and parameters
- **THEN** gateway routes request to appropriate MCP server and returns result

#### Scenario: Invalid tool name
- **WHEN** client requests nonexistent tool
- **THEN** gateway returns error indicating tool not found

### Requirement: Multi-Server Aggregation
The gateway SHALL connect to multiple MCP servers and aggregate their tools.

#### Scenario: Connect to configured servers
- **WHEN** gateway starts
- **THEN** system establishes connections to all servers in config file immediately

#### Scenario: Namespace tool names
- **WHEN** multiple servers provide tools with same name
- **THEN** gateway prefixes tool names with server name using double underscore (e.g., `github__create_issue`)

#### Scenario: Validate and convert server names
- **WHEN** server name contains invalid JavaScript identifier characters (e.g., hyphens, starting with numbers)
- **THEN** gateway converts names to valid identifiers (e.g., "github-api" becomes "github_api", "123server" becomes "_123server")

#### Scenario: Server connection failure
- **WHEN** one server fails to connect
- **THEN** gateway continues with remaining servers and logs error

#### Scenario: All servers connect at startup
- **WHEN** gateway starts
- **THEN** system connects to all configured servers eagerly, not lazily

#### Scenario: Launch with no configuration
- **WHEN** gateway starts with no config file or zero servers configured
- **THEN** gateway starts successfully with zero servers connected and empty tools list

### Requirement: Persistent Connections
The gateway SHALL maintain persistent connections to MCP servers.

#### Scenario: Connection pooling
- **WHEN** multiple toolscripts execute
- **THEN** gateway reuses existing server connections

#### Scenario: Connection health monitoring
- **WHEN** server connection becomes unhealthy
- **THEN** gateway attempts reconnection with exponential backoff

#### Scenario: Graceful connection closure
- **WHEN** gateway shuts down
- **THEN** system cleanly closes all server connections

### Requirement: Port Allocation
The gateway SHALL allocate a port for HTTP listening based on CLI parameters.

#### Scenario: Random port allocation
- **WHEN** CLI --port parameter is 0 or not specified
- **THEN** gateway allocates random available port

#### Scenario: Fixed port allocation
- **WHEN** CLI --port parameter specifies a port number
- **THEN** gateway attempts to bind to that port

#### Scenario: Port conflict
- **WHEN** specified port is already in use
- **THEN** gateway exits with error indicating port conflict

#### Scenario: URL discovery via environment variable
- **WHEN** SessionStart hook starts gateway
- **THEN** hook writes TOOLSCRIPT_GATEWAY_URL (full URL with protocol and port) to environment variable for client discovery

### Requirement: Lifecycle Management
The gateway SHALL run for the entire Claude Code session duration.

#### Scenario: Start gateway on session start
- **WHEN** SessionStart hook executes
- **THEN** hook starts gateway in background, which initializes and connects to all servers

#### Scenario: Gateway runs until terminated
- **WHEN** gateway is running
- **THEN** gateway continues running until process receives termination signal (SIGTERM, SIGINT, SIGKILL)

#### Scenario: Stop gateway via process termination
- **WHEN** SessionEnd hook executes
- **THEN** hook reads PID file and kills the gateway process

#### Scenario: Emergency shutdown
- **WHEN** system receives SIGKILL
- **THEN** gateway terminates immediately, SessionEnd hook cleans up stale PID

#### Scenario: PID file management
- **WHEN** gateway starts
- **THEN** SessionStart hook writes PID file containing only the process ID
- **WHEN** SessionEnd hook executes
- **THEN** hook kills process via PID file and removes PID file after stopping process

### Requirement: Session Tracking
The gateway SHALL associate with Claude Code session IDs.

#### Scenario: Session-based PID file
- **WHEN** gateway starts with SESSION_ID environment variable
- **THEN** system includes session_id in PID file metadata

#### Scenario: Session cleanup
- **WHEN** SessionEnd hook triggers
- **THEN** system stops gateway instances matching that session_id

#### Scenario: Multiple sessions
- **WHEN** multiple Claude sessions are active
- **THEN** each session maintains independent gateway instance

### Requirement: Runtime Tools HTTP Endpoint
The gateway SHALL serve generated TypeScript tools module via HTTP for Deno HTTP imports.

#### Scenario: Serve tools module
- **WHEN** client requests GET /runtime/tools.ts
- **THEN** gateway returns generated TypeScript module with Content-Type: application/typescript

#### Scenario: Module contains all servers
- **WHEN** /runtime/tools.ts is requested
- **THEN** module exports tools object with all configured servers as camelCase properties

#### Scenario: Module uses TypeScript naming conventions
- **WHEN** module is generated
- **THEN** functions are camelCase, types are PascalCase, namespaces are camelCase

#### Scenario: Module cached in memory
- **WHEN** /runtime/tools.ts requested multiple times
- **THEN** gateway serves cached module without regenerating

#### Scenario: Cache invalidation on changes
- **WHEN** MCP server reconnects or tools change
- **THEN** gateway regenerates module cache

#### Scenario: Empty module with no servers
- **WHEN** /runtime/tools.ts is requested and no servers are configured
- **THEN** gateway returns module with export const tools = {}

### Requirement: Type Filtering
The gateway SHALL support query parameter filtering to reduce generated type module size for specific use cases.

#### Scenario: Filter by server name
- **WHEN** client requests GET /runtime/tools.ts?server=github
- **THEN** gateway returns module containing only tools from github server

#### Scenario: Filter by server and tool
- **WHEN** client requests GET /runtime/tools.ts?server=github&tool=createIssue
- **THEN** gateway returns module containing only the createIssue tool from github server

#### Scenario: Return all tools without filter
- **WHEN** client requests GET /runtime/tools.ts with no query parameters
- **THEN** gateway returns module with all tools from all servers

#### Scenario: Invalid server name
- **WHEN** client requests GET /runtime/tools.ts?server=nonexistent
- **THEN** gateway returns module with empty tools object

#### Scenario: Invalid tool name
- **WHEN** client requests GET /runtime/tools.ts?server=github&tool=nonexistent
- **THEN** gateway returns module with empty tools object for that server

#### Scenario: Tool filter requires server
- **WHEN** client requests GET /runtime/tools.ts?tool=createIssue without server parameter
- **THEN** gateway returns error or ignores tool filter and returns all servers

### Requirement: Health Monitoring
The gateway SHALL provide health check endpoints.

#### Scenario: Health check endpoint
- **WHEN** client requests `/health`
- **THEN** gateway returns 200 OK with server status

#### Scenario: Ready check endpoint
- **WHEN** client requests `/ready`
- **THEN** gateway returns 200 if all configured servers are connected

#### Scenario: Server status endpoint
- **WHEN** client requests `/status`
- **THEN** gateway returns JSON with per-server connection status

### Requirement: Request Timeout
The gateway SHALL enforce timeouts on server requests using Deno's default behavior.

#### Scenario: Default timeout
- **WHEN** tool execution exceeds reasonable duration
- **THEN** gateway relies on Deno's default timeout handling

### Requirement: Error Handling
The gateway SHALL provide detailed error responses.

#### Scenario: Server error
- **WHEN** MCP server returns error
- **THEN** gateway forwards error to client with server name context

#### Scenario: Network error
- **WHEN** connection to server fails
- **THEN** gateway returns service unavailable error with retry advice

#### Scenario: Validation error
- **WHEN** tool parameters fail validation
- **THEN** gateway returns bad request error with validation details

### Requirement: Logging
The gateway SHALL log operations for debugging.

#### Scenario: Request logging
- **WHEN** client makes request
- **THEN** gateway logs request method, tool name, and duration

#### Scenario: Error logging
- **WHEN** error occurs
- **THEN** gateway logs error details with stack trace

#### Scenario: Connection logging
- **WHEN** server connection state changes
- **THEN** gateway logs connection events

#### Scenario: Configurable log levels
- **WHEN** environment variable LOG_LEVEL is set
- **THEN** gateway adjusts logging verbosity accordingly

