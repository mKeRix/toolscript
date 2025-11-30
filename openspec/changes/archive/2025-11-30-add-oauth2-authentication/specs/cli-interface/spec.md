# cli-interface Specification Delta

## Purpose
Add standalone `toolscript auth` command for explicit OAuth2 authorization that runs independently of the gateway.

## ADDED Requirements

### Requirement: Standalone Auth Command
The system SHALL provide a standalone CLI command for OAuth2 authorization.

#### Scenario: Invoke auth command with server name
- **WHEN** user runs `toolscript auth <server-name>`
- **THEN** system initiates OAuth2 authentication for specified server

#### Scenario: Auth command runs without gateway
- **WHEN** user runs `toolscript auth <server>`
- **THEN** command executes successfully even if gateway is not running

#### Scenario: Auth command validates server exists in config
- **WHEN** user runs `toolscript auth <unknown-server>`
- **THEN** command fails with error listing available servers

#### Scenario: Auth command works with server with no oauth config
- **WHEN** user runs `toolscript auth` on server without oauth field
- **THEN** command performs OAuth discovery and attempts dynamic client registration


#### Scenario: Auth command starts temporary callback server
- **WHEN** auth command initiates Authorization Code flow
- **THEN** command starts temporary HTTP server on random available port

#### Scenario: Auth command logs authorization URL
- **WHEN** authorization URL is generated
- **THEN** command logs the complete authorization URL to stdout

#### Scenario: Auth command opens browser for authorization
- **WHEN** temporary callback server is ready
- **THEN** command attempts to open default browser to authorization URL

#### Scenario: Auth command displays URL fallback message
- **WHEN** browser cannot be opened automatically
- **THEN** command displays message "Could not open browser automatically. Please open the URL above in your browser."

#### Scenario: Auth command waits for callback
- **WHEN** browser is opened for authorization
- **THEN** command waits for OAuth2 callback with progress indicator

#### Scenario: Auth command handles callback and exchanges code
- **WHEN** OAuth2 provider redirects to callback URL
- **THEN** temporary server exchanges code for tokens via MCP SDK

#### Scenario: Auth command saves OAuth data
- **WHEN** token exchange succeeds
- **THEN** command saves client info and tokens to `~/.toolscript/oauth/<server>.json`

#### Scenario: Auth command shuts down callback server
- **WHEN** token exchange completes or fails
- **THEN** temporary callback server shuts down cleanly

#### Scenario: Auth command reports success
- **WHEN** authentication completes successfully
- **THEN** command displays success message and exits with code 0

#### Scenario: Auth command reports failure
- **WHEN** authentication fails or times out
- **THEN** command displays error message with details and exits with non-zero code

#### Scenario: Auth command times out after 5 minutes
- **WHEN** user does not complete authorization within 5 minutes
- **THEN** command times out, cleans up, and displays error

#### Scenario: Auth command can be cancelled
- **WHEN** user presses Ctrl+C during auth command
- **THEN** command cancels gracefully, shuts down callback server, and cleans up

### Requirement: Dynamic Client Registration in Auth Command
The system SHALL support dynamic client registration during auth command execution.

#### Scenario: Auth command attempts dynamic registration
- **WHEN** no stored client_id exists and no oauth.clientId in config
- **AND** server discovery includes registration_endpoint
- **THEN** command performs dynamic client registration

#### Scenario: Auth command displays registration progress
- **WHEN** dynamic registration is attempted
- **THEN** command displays "Registering client..." progress message

#### Scenario: Auth command reports registration success
- **WHEN** dynamic registration succeeds
- **THEN** command displays "✓ Client registered successfully"

#### Scenario: Auth command reports registration failure
- **WHEN** server doesn't support dynamic registration
- **THEN** command displays error asking user to add oauth.clientId to config

### Requirement: Auth Command Help
The system SHALL provide help information for auth command.

#### Scenario: Display auth command in help
- **WHEN** user runs `toolscript --help` or `toolscript help`
- **THEN** help output includes `auth` command with description

#### Scenario: Auth command usage information
- **WHEN** user runs `toolscript auth --help`
- **THEN** command displays usage information including server-name parameter and examples

#### Scenario: List servers when no server-name provided
- **WHEN** user runs `toolscript auth` without server-name
- **THEN** command lists all servers that support OAuth2 authentication with their authentication status

#### Scenario: Auth status shows authenticated state
- **WHEN** listing servers with `toolscript auth`
- **AND** server has valid stored tokens
- **THEN** status displays as "authenticated"

#### Scenario: Auth status shows not authenticated state
- **WHEN** listing servers with `toolscript auth`
- **AND** server has no stored tokens or expired tokens
- **THEN** status displays as "not authenticated"

### Requirement: Auth Command Output
The system SHALL provide clear output during auth command execution.

#### Scenario: Progress indicator for OAuth discovery
- **WHEN** auth command performs OAuth discovery
- **THEN** display "Performing OAuth discovery..." message

#### Scenario: Progress indicator for client credential resolution
- **WHEN** checking for stored client or config clientId
- **THEN** display appropriate message (e.g., "Using stored client...", "Using client_id from config...")

#### Scenario: Progress indicator for callback server
- **WHEN** starting temporary callback server
- **THEN** display "Starting callback server on port <port>..."

#### Scenario: Display authorization URL
- **WHEN** authorization URL is generated
- **THEN** display complete URL with label "Authorization URL: <url>"

#### Scenario: Progress indicator for browser opening
- **WHEN** attempting to open browser
- **THEN** display "Opening browser for authorization..."

#### Scenario: Progress indicator for waiting
- **WHEN** waiting for user authorization
- **THEN** display "Waiting for authorization..." with progress spinner or dots

#### Scenario: Success message
- **WHEN** auth command succeeds
- **THEN** display "✓ Authorization successful! Credentials stored securely."

#### Scenario: Standard output for success
- **WHEN** auth command succeeds
- **THEN** success message is written to stdout

#### Scenario: Standard error for failures
- **WHEN** auth command fails
- **THEN** error message is written to stderr

#### Scenario: Exit code 0 on success
- **WHEN** auth command completes successfully
- **THEN** command exits with code 0

#### Scenario: Exit code non-zero on failure
- **WHEN** auth command fails
- **THEN** command exits with non-zero code