# gateway-server Specification Delta

## Purpose
Extend gateway server to support OAuth2 authentication using OAuth discovery, with explicit user control for Authorization Code flow.

## MODIFIED Requirements

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

### Requirement: Lifecycle Management
The system SHALL manage gateway startup, operation, and shutdown.

#### Scenario: Warn about unauthenticated Authorization Code servers
- **WHEN** gateway starts with Authorization Code server without valid tokens
- **THEN** gateway logs warning indicating auth is required and shows `toolscript auth` command

#### Scenario: Automatic authentication for Client Credentials servers
- **WHEN** gateway starts with Client Credentials server
- **THEN** system automatically authenticates using client credentials before reporting gateway ready

#### Scenario: Client Credentials auth failure is non-fatal
- **WHEN** Client Credentials authentication fails at startup
- **THEN** gateway marks server as failed but continues startup for other servers

## ADDED Requirements

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
- **THEN** oauth_status is "pending_authorization" for authorization_code, "pending_authentication" for client_credentials during initial auth

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

#### Scenario: Client Credentials auth failure reported clearly
- **WHEN** Client Credentials authentication fails
- **THEN** error includes details about credential validity and token endpoint

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
