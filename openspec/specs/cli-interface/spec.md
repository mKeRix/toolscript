# cli-interface Specification

## Purpose
TBD - created by archiving change add-initial-toolscript-architecture. Update Purpose after archive.
## Requirements
### Requirement: Command Structure
The CLI SHALL provide a main `toolscript` command with subcommands for different operations.

#### Scenario: Display help
- **WHEN** user runs `toolscript --help`
- **THEN** system displays available commands and global options

#### Scenario: Display version
- **WHEN** user runs `toolscript --version`
- **THEN** system displays the current version number

#### Scenario: Invalid command
- **WHEN** user runs an unrecognized command
- **THEN** system displays error message and suggests `--help`

### Requirement: List Servers Command
The CLI SHALL provide a `list-servers` command that displays all configured MCP servers.

#### Scenario: List all servers
- **WHEN** user runs `toolscript list-servers`
- **THEN** system displays names and descriptions of all configured servers

#### Scenario: JSON output
- **WHEN** user runs `toolscript list-servers --json`
- **THEN** system outputs server list as JSON array

#### Scenario: No servers configured
- **WHEN** user runs `toolscript list-servers` with no config file or empty config
- **THEN** system returns empty list with no error

### Requirement: List Tools Command
The CLI SHALL provide a `list-tools` command that displays tools for a specific server.

#### Scenario: List tools for server
- **WHEN** user runs `toolscript list-tools github`
- **THEN** system displays all tools available from the github server

#### Scenario: Server not found
- **WHEN** user runs `toolscript list-tools nonexistent`
- **THEN** system displays error indicating server not found

#### Scenario: No config file
- **WHEN** user runs `toolscript list-tools github` with no config file
- **THEN** system displays error indicating server not found (zero servers configured)

#### Scenario: Include descriptions
- **WHEN** user runs `toolscript list-tools github --verbose`
- **THEN** system displays tool names with their descriptions

### Requirement: Get Types Command
The CLI's existing Get Types Command **MUST** be modified to use the filter parameter instead of server/tool query parameters.

#### Scenario: Fetch types using filter parameter
**WHEN** user runs `toolscript get-types --filter github__create_issue`
**THEN** system fetches module from gateway at `${TOOLSCRIPT_GATEWAY_URL}/runtime/tools.ts?filter=github__create_issue`
**AND** displays TypeScript types in Markdown format

#### Scenario: Get types for all tools in server
**WHEN** user runs `toolscript get-types --filter github`
**THEN** system fetches module from gateway HTTP endpoint with `?filter=github` query parameter
**AND** returns all tools from github server

#### Scenario: Get types for multiple servers and tools
**WHEN** user runs `toolscript get-types --filter github,myserver__echo`
**THEN** system fetches module with `?filter=github,myserver__echo` query parameter
**AND** returns combined TypeScript module with all specified tools

#### Scenario: Markdown output format preserved
**WHEN** types command executes with filter parameter
**THEN** output format matches existing behavior: first code block contains TypeScript definitions, second code block shows usage example
**AND** example shows `import { tools } from "toolscript"` and camelCase tool calls

#### Scenario: No config file for types
**WHEN** user runs `toolscript get-types --filter github` with no config file
**THEN** system displays error indicating server not found (zero servers configured)

### Requirement: Execute Inline Code
The CLI SHALL provide an `exec` command that executes inline TypeScript code.

#### Scenario: Execute inline toolscript
- **WHEN** user runs `toolscript exec "console.log('hello')"`
- **THEN** system executes the code in sandbox and displays output

#### Scenario: Access MCP tools in inline code via clean import
- **WHEN** user runs `toolscript exec "import { tools } from 'toolscript'; console.log(await tools.github.listIssues())"`
- **THEN** system generates import map, executes code with TOOLSCRIPT_GATEWAY_PORT environment variable, and Deno resolves "toolscript" via import map to gateway HTTP endpoint

#### Scenario: Execution error
- **WHEN** inline code throws an error
- **THEN** system displays error message and stack trace to stderr

#### Scenario: Execute with empty tools
- **WHEN** user runs `toolscript exec "import { tools } from 'toolscript'; console.log(tools)"` with no config file
- **THEN** system executes successfully and outputs empty tools object: {}

### Requirement: Execute File-Based Toolscript
The CLI SHALL execute TypeScript files passed as arguments.

#### Scenario: Execute toolscript file
- **WHEN** user runs `toolscript script.ts`
- **THEN** system executes the script file in sandbox

#### Scenario: File not found
- **WHEN** user runs `toolscript nonexistent.ts`
- **THEN** system displays file not found error

#### Scenario: Relative and absolute paths
- **WHEN** user provides relative or absolute file path
- **THEN** system resolves and executes the correct file

### Requirement: Gateway Management
The CLI SHALL provide a command to start the gateway server.

#### Scenario: Start gateway manually
- **WHEN** user runs `toolscript gateway start --port 3000`
- **THEN** system starts gateway server on specified port (or random if not specified), displays the URL, and runs until process is stopped

#### Scenario: Check gateway status
- **WHEN** user runs `toolscript gateway status`
- **THEN** system displays whether gateway is running and its URL

#### Scenario: Port parameter
- **WHEN** user runs `toolscript gateway start --port 3000`
- **THEN** gateway binds to port 3000, or random port if 0 or not specified

#### Scenario: Stop gateway process
- **WHEN** user wants to stop the gateway
- **THEN** user stops the process (Ctrl+C, kill command, etc.) - there is no gateway stop command

### Requirement: Standard IO Handling
The CLI SHALL handle input/output according to Unix conventions.

#### Scenario: Return value to stdout
- **WHEN** toolscript returns a value
- **THEN** system writes the return value to stdout

#### Scenario: Console.log to stdout
- **WHEN** toolscript uses `console.log()`
- **THEN** system writes output to stdout

#### Scenario: Console.error to stderr
- **WHEN** toolscript uses `console.error()`
- **THEN** system writes output to stderr

#### Scenario: Exit codes
- **WHEN** toolscript executes successfully
- **THEN** system exits with code 0
- **WHEN** toolscript throws error
- **THEN** system exits with code 1

### Requirement: Shell Integration
The CLI SHALL support Unix-style piping and command composition.

#### Scenario: Pipe output to other commands
- **WHEN** user runs `toolscript exec "return {count: 42}" | jq .count`
- **THEN** output is pipeable to downstream commands

#### Scenario: Chain with shell commands
- **WHEN** user runs `toolscript list-servers | grep github`
- **THEN** output integrates with shell tools

### Requirement: Error Reporting
The CLI SHALL provide clear, actionable error messages.

#### Scenario: Configuration error
- **WHEN** config file is invalid
- **THEN** system displays specific validation error with line number

#### Scenario: Gateway connection error
- **WHEN** gateway is not accessible
- **THEN** system displays connection error and suggests checking gateway status

#### Scenario: Type generation error
- **WHEN** type generation fails
- **THEN** system displays schema validation error with details

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

