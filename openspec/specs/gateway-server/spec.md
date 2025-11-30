# gateway-server Specification

## Purpose
TBD - created by archiving change add-initial-toolscript-architecture. Update Purpose after archive.
## Requirements
### Requirement: HTTP MCP Server
The system SHALL connect to HTTP MCP servers via StreamableHTTP or SSE transport.

#### Scenario: Connect with OAuth2 provider
- **WHEN** server config includes oauth field
- **THEN** system creates OAuth2 provider and passes to transport via authProvider option

#### Scenario: Automatic token refresh via MCP SDK
- **WHEN** OAuth2 token expires during MCP session
- **THEN** MCP SDK automatically refreshes token via authProvider without manual intervention

#### Scenario: Use OAuth discovery for endpoints
- **WHEN** connecting to OAuth2 server
- **THEN** MCP SDK uses OAuth discovery to obtain authorization server metadata

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
The system SHALL manage gateway startup, operation, and shutdown.

#### Scenario: Warn about unauthenticated Authorization Code servers
- **WHEN** gateway starts with Authorization Code server without valid tokens
- **THEN** gateway logs warning indicating auth is required and shows `toolscript auth` command

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
The gateway's existing Type Filtering requirement **MUST** be modified to replace server/tool query parameters with a unified filter parameter.

#### Scenario: Filter by server name
**WHEN** client requests GET `/runtime/tools.ts?filter=github`
**THEN** gateway returns module containing only tools from github server
**AND** output format matches existing type generation behavior

#### Scenario: Filter by specific tool using double underscore separator
**WHEN** client requests GET `/runtime/tools.ts?filter=myserver__echo`
**THEN** gateway parses "myserver" as server name
**AND** parses "echo" as tool name
**AND** returns module containing only the echo tool from myserver

#### Scenario: Filter multiple servers and tools
**WHEN** client requests GET `/runtime/tools.ts?filter=github,myserver__echo,otherserver__read_file`
**THEN** gateway parses comma-separated identifiers
**AND** resolves "github" to all tools from github server
**AND** resolves "myserver__echo" to specific echo tool
**AND** resolves "otherserver__read_file" to specific read_file tool
**AND** returns module with all matching tools combined

#### Scenario: Return all tools without filter
**WHEN** client requests GET `/runtime/tools.ts` with no query parameters
**THEN** gateway returns module with all tools from all servers
**AND** behavior matches existing unfiltered endpoint

#### Scenario: Invalid server name in filter
**WHEN** client requests GET `/runtime/tools.ts?filter=nonexistent`
**THEN** gateway returns module with empty tools object

#### Scenario: Invalid tool name in filter
**WHEN** client requests GET `/runtime/tools.ts?filter=github__nonexistent`
**THEN** gateway returns module excluding that invalid tool reference

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

### Requirement: OAuth2 Callback Endpoint
The gateway SHALL host an OAuth2 callback endpoint for Authorization Code flow initiated by `toolscript auth` command.

#### Scenario: Register callback route
- **WHEN** gateway starts
- **THEN** system registers GET /oauth/callback route

#### Scenario: Accept authorization callback
- **WHEN** OAuth2 provider redirects to /oauth/callback?code=...&state=...
- **THEN** gateway receives request and extracts code and state parameters

#### Scenario: Validate callback state for CSRF protection
- **WHEN** callback request includes state parameter
- **THEN** gateway validates state matches expected value from pending auth session

#### Scenario: Exchange code for tokens via MCP SDK
- **WHEN** valid authorization code is received
- **THEN** gateway uses MCP SDK's auth module to exchange code for tokens

#### Scenario: Save tokens via provider
- **WHEN** token exchange succeeds
- **THEN** provider's saveTokens() method is called to persist tokens to storage

#### Scenario: Return success HTML page
- **WHEN** token exchange succeeds
- **THEN** callback endpoint returns HTML page with success message

#### Scenario: Return error HTML page on failure
- **WHEN** token exchange fails
- **THEN** callback endpoint returns HTML page with error message and details

#### Scenario: Associate callback with correct server
- **WHEN** multiple auth sessions are pending
- **THEN** state parameter identifies which server's auth flow to complete

#### Scenario: Reject callback with invalid state
- **WHEN** callback state does not match any pending auth session
- **THEN** return error page indicating invalid or expired authorization attempt

### Requirement: OAuth2 State Tracking
The gateway SHALL track OAuth2 authentication state per server.

#### Scenario: Track authentication status in aggregator
- **WHEN** server has OAuth2 config
- **THEN** aggregator tracks whether server is authenticated, pending, or failed

#### Scenario: Expose OAuth2 status in /servers endpoint
- **WHEN** GET /servers is called
- **THEN** response includes oauth_status field for OAuth2 servers

#### Scenario: OAuth2 status: authenticated
- **WHEN** server has valid tokens
- **THEN** oauth_status is "authenticated"

#### Scenario: OAuth2 status: pending
- **WHEN** server requires auth but has no tokens
- **THEN** oauth_status is "pending_authorization"

#### Scenario: OAuth2 status: failed
- **WHEN** OAuth2 authentication failed
- **THEN** oauth_status is "authentication_failed" with error message

#### Scenario: No OAuth2 status for non-OAuth2 servers
- **WHEN** server has no oauth config
- **THEN** oauth_status field is absent from response

### Requirement: OAuth2 Error Responses
The gateway SHALL provide clear error responses for OAuth2 authentication failures.

#### Scenario: Tool call to unauthenticated server fails
- **WHEN** tool is called on server requiring auth without valid tokens
- **THEN** request returns 401 with error indicating auth required and `toolscript auth` command

#### Scenario: Token refresh failure handling
- **WHEN** token refresh fails for any reason
- **THEN** MCP SDK triggers re-authentication flow or returns auth error

### Requirement: OAuth2 Logging in Gateway
The gateway SHALL log OAuth2 authentication events.

#### Scenario: Log OAuth discovery
- **WHEN** OAuth discovery is performed
- **THEN** log server name and discovery endpoint at DEBUG level

#### Scenario: Log flow type inference
- **WHEN** flow type is inferred from config
- **THEN** log server name and inferred flow type at INFO level

#### Scenario: Log successful authentication
- **WHEN** OAuth2 tokens acquired successfully
- **THEN** log success message at INFO level without token values

#### Scenario: Log authentication failures
- **WHEN** OAuth2 authentication fails
- **THEN** log error details at ERROR level with actionable guidance

#### Scenario: Log token refresh events
- **WHEN** tokens are refreshed
- **THEN** log refresh event at DEBUG level

#### Scenario: Log callback events
- **WHEN** callback endpoint receives requests
- **THEN** log state validation result and outcome at DEBUG level

#### Scenario: Never log sensitive values
- **WHEN** logging OAuth2 events
- **THEN** tokens, secrets, codes, state must never appear in logs

