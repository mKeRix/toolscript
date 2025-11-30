# oauth2-authentication Specification

## Purpose
TBD - created by archiving change add-oauth2-authentication. Update Purpose after archive.
## Requirements
### Requirement: Optional OAuth Configuration
The system SHALL make OAuth configuration completely optional, using discovery to detect authentication requirements.

#### Scenario: No oauth field triggers discovery on auth
- **WHEN** server config has no oauth field
- **AND** user runs `toolscript auth <server>`
- **THEN** system performs OAuth discovery and attempts dynamic client registration

#### Scenario: Gateway detects OAuth via 401 response
- **WHEN** gateway connects to server without oauth config
- **AND** server returns 401 Unauthorized
- **THEN** gateway performs OAuth discovery to detect if OAuth is required

#### Scenario: Discovery indicates OAuth required
- **WHEN** OAuth discovery succeeds and indicates auth required
- **THEN** system checks for stored credentials or prompts user to run auth command

### Requirement: OAuth Discovery
The system SHALL use MCP server's OAuth discovery endpoint to obtain authorization server metadata.

#### Scenario: Fetch OAuth metadata from server
- **WHEN** connecting to server or running auth command
- **THEN** system uses MCP SDK to fetch OAuth authorization server metadata

#### Scenario: Extract endpoints from discovery metadata
- **WHEN** OAuth metadata is retrieved
- **THEN** metadata includes authorization_endpoint, token_endpoint, and optionally registration_endpoint, revocation_endpoint

#### Scenario: Use discovered endpoints for OAuth flow
- **WHEN** performing OAuth2 authentication
- **THEN** system uses endpoints from discovery response, never manual configuration

#### Scenario: Fail gracefully when discovery unavailable
- **WHEN** OAuth discovery endpoint returns error or not found
- **THEN** system reports error indicating server does not support OAuth2 or is misconfigured

### Requirement: Dynamic Client Registration
The system SHALL support dynamic client registration (RFC 7591) as the primary method for obtaining client credentials.

#### Scenario: Detect registration endpoint in discovery
- **WHEN** OAuth discovery metadata includes registration_endpoint
- **THEN** system marks dynamic registration as available

#### Scenario: Register new client dynamically
- **WHEN** no stored client_id exists and registration_endpoint available
- **THEN** system POSTs client metadata to registration_endpoint

#### Scenario: Save dynamically registered client info
- **WHEN** dynamic registration succeeds
- **THEN** system saves client_id to file-based storage

#### Scenario: Reuse dynamically registered client
- **WHEN** stored client registration exists in storage backend
- **THEN** system reuses that client_id instead of registering again

#### Scenario: Registration metadata for redirect_uri
- **WHEN** performing dynamic registration
- **THEN** request includes redirect_uris with callback server URL pattern

#### Scenario: Fallback when registration unavailable
- **WHEN** discovery metadata lacks registration_endpoint
- **AND** no stored client registration exists
- **THEN** system reports error indicating server does not support dynamic registration

### Requirement: Combined OAuth Data Storage
The system SHALL store both client registration and tokens together per server using secure file-based storage.

#### Scenario: File-based storage with secure permissions
- **WHEN** OAuth data needs to be stored
- **THEN** data is written to `~/.toolscript/oauth/<server>.json`
- **AND** file permissions are set to 0600 (read/write owner only) on Unix-like systems
- **AND** directory permissions are set to 0700 (owner only)

#### Scenario: Server name sanitization
- **WHEN** determining storage file path
- **THEN** server name is sanitized to prevent directory traversal attacks
- **AND** only alphanumeric characters, underscores, and hyphens are allowed

#### Scenario: Storage contains client and tokens sections
- **WHEN** OAuth data is stored
- **THEN** data has structure with client{} and tokens{} sections

#### Scenario: Client section includes registration source
- **WHEN** client info is stored
- **THEN** client section includes registration_source field ("dynamic")

#### Scenario: Tokens section matches MCP SDK OAuthTokens
- **WHEN** tokens are saved
- **THEN** tokens section includes access_token, refresh_token, expires_at, token_type, scope

#### Scenario: Load combined data on provider creation
- **WHEN** OAuth provider is created for server
- **THEN** provider loads both client info and tokens from file-based storage

### Requirement: Authorization Code Flow
The system SHALL use Authorization Code flow for all OAuth2 authentication.

#### Scenario: Authorization Code flow always used
- **WHEN** OAuth authentication is required
- **THEN** system uses Authorization Code flow with dynamic client registration or pre-registered client credentials

### Requirement: Standalone Auth Command
The system SHALL provide a standalone auth command that does not require the gateway to be running.

#### Scenario: Auth command runs independently
- **WHEN** user runs `toolscript auth <server>`
- **THEN** command executes without checking if gateway is running

#### Scenario: Start temporary callback server
- **WHEN** auth command initiates Authorization Code flow
- **THEN** command starts temporary HTTP server on random available port

#### Scenario: Callback server handles OAuth redirect
- **WHEN** OAuth provider redirects to callback URL
- **THEN** temporary server receives callback and extracts authorization code

#### Scenario: Shutdown callback server after completion
- **WHEN** token exchange completes or fails
- **THEN** temporary callback server shuts down cleanly

#### Scenario: Display success message and exit
- **WHEN** authentication completes successfully
- **THEN** command displays success message and exits with code 0

### Requirement: MCP SDK OAuth Provider Integration
The system SHALL use MCP SDK's built-in OAuth providers with persistent storage backend.

#### Scenario: Implement OAuthClientProvider
- **WHEN** OAuth authentication is required
- **THEN** system implements MCP SDK's OAuthClientProvider interface

#### Scenario: Provider delegates OAuth logic to MCP SDK
- **WHEN** OAuth operations are performed
- **THEN** provider uses MCP SDK for token exchange, refresh, PKCE

#### Scenario: Provider loads from combined storage
- **WHEN** SDK calls tokens() method
- **THEN** provider loads from storage backend tokens section

#### Scenario: Provider saves to combined storage
- **WHEN** SDK calls saveTokens() method
- **THEN** provider saves to storage backend tokens section

#### Scenario: Provider loads client info from storage
- **WHEN** SDK calls clientInformation() method
- **THEN** provider loads from storage backend client section

#### Scenario: Provider saves client info to storage
- **WHEN** SDK calls saveClientInformation() method (after dynamic registration)
- **THEN** provider saves to storage backend client section

### Requirement: Automatic Token Refresh
The system SHALL automatically refresh expired OAuth2 tokens via MCP SDK.

#### Scenario: MCP SDK handles token refresh
- **WHEN** transport detects expired token
- **THEN** MCP SDK automatically calls provider to refresh token

#### Scenario: Provider loads refresh_token from storage
- **WHEN** refresh is triggered
- **THEN** provider returns refresh_token from storage via tokens() method

#### Scenario: Provider saves refreshed tokens
- **WHEN** SDK obtains new access token
- **THEN** SDK calls provider's saveTokens() with updated tokens

#### Scenario: Refresh failure for authorization_code
- **WHEN** token refresh fails for authorization_code server
- **THEN** system clears stored tokens and requires user to run `toolscript auth` again

### Requirement: Gateway OAuth Integration
The system SHALL integrate OAuth authentication into gateway connection flow.

#### Scenario: Gateway loads OAuth data from storage
- **WHEN** gateway starts with server
- **THEN** system attempts to load OAuth data from file-based storage

#### Scenario: Gateway connects with stored tokens
- **WHEN** valid tokens exist in storage
- **THEN** gateway uses tokens to connect without user interaction

#### Scenario: Gateway warns about missing auth
- **WHEN** server requires OAuth but no stored tokens exist
- **THEN** gateway logs warning with `toolscript auth <server>` command

### Requirement: OAuth2 Logging
The system SHALL log OAuth2 authentication events for debugging.

#### Scenario: Log OAuth discovery attempt
- **WHEN** OAuth discovery is initiated
- **THEN** log server name and URL at DEBUG level

#### Scenario: Log dynamic registration attempt
- **WHEN** dynamic client registration is attempted
- **THEN** log registration_endpoint URL at DEBUG level

#### Scenario: Log client credential source
- **WHEN** client credentials are obtained
- **THEN** log source (stored or dynamic) at INFO level

#### Scenario: Log successful authentication
- **WHEN** tokens are successfully obtained
- **THEN** log success message without token values at INFO level

#### Scenario: Log token refresh
- **WHEN** tokens are refreshed
- **THEN** log refresh event at DEBUG level

#### Scenario: Log authentication errors
- **WHEN** OAuth2 errors occur
- **THEN** log error details at ERROR level with actionable guidance

#### Scenario: Never log sensitive values
- **WHEN** logging OAuth2 events
- **THEN** tokens, secrets, codes, state parameters must never appear in logs

### Requirement: OAuth2 State Management
The system SHALL manage OAuth2 state parameters for CSRF protection.

#### Scenario: Generate random state parameter
- **WHEN** initiating authorization request
- **THEN** system generates cryptographically random state value

#### Scenario: MCP SDK handles PKCE automatically
- **WHEN** using Authorization Code flow
- **THEN** MCP SDK automatically generates and validates PKCE code challenge

#### Scenario: Validate state on callback
- **WHEN** callback includes state parameter
- **THEN** validate state matches expected value for this auth session

#### Scenario: Reject mismatched state
- **WHEN** callback state does not match expected value
- **THEN** reject request and report CSRF attack attempt

#### Scenario: Clear state after use
- **WHEN** token exchange completes or fails
- **THEN** clear stored state value

### Requirement: Error Handling
The system SHALL provide clear error messages for OAuth2 failures.

#### Scenario: Server requires OAuth but no credentials available
- **WHEN** gateway connects to server requiring OAuth
- **AND** no stored OAuth data exists
- **THEN** error message: "Server requires OAuth2. Run: toolscript auth <server>"

#### Scenario: Dynamic registration not supported
- **WHEN** auth command runs with no stored credentials
- **AND** server doesn't support dynamic registration
- **THEN** error message: "Server does not support dynamic client registration and cannot be authenticated without pre-registered credentials"

#### Scenario: OAuth discovery fails
- **WHEN** OAuth discovery returns error
- **THEN** error message: "Server does not support OAuth2 or is misconfigured"

