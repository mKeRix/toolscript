# Capability: Configuration

## ADDED Requirements

### Requirement: Configuration File Format
The system SHALL support JSON format for configuration files.

#### Scenario: Valid JSON config
- **WHEN** config file contains valid JSON
- **THEN** system parses and validates configuration

#### Scenario: Invalid JSON
- **WHEN** config file has JSON syntax errors
- **THEN** system reports parse error with line number and column

#### Scenario: Missing config file allows gateway launch
- **WHEN** no config file exists at default or specified location
- **THEN** system allows gateway to launch with zero MCP servers configured

### Requirement: MCP Server Configuration
The config file SHALL follow Claude Code's MCP server configuration format.

#### Scenario: Define server with command
- **WHEN** config includes server with type, command and args
- **THEN** system can start that server process

#### Scenario: Server type specification
- **WHEN** server config includes type field
- **THEN** type must be one of: "stdio", "http", "sse"

#### Scenario: Server environment variables
- **WHEN** server config includes env object
- **THEN** system passes environment variables to server process

#### Scenario: Environment variable substitution
- **WHEN** server env value uses `${VAR_NAME}` syntax
- **THEN** system substitutes with value from parent environment

#### Scenario: Environment variable with default
- **WHEN** server env value uses `${VAR_NAME:-default}` syntax
- **THEN** system substitutes with value from parent environment or uses default if not set

#### Scenario: HTTP server with URL
- **WHEN** server config has type "http" and includes url property
- **THEN** system connects to MCP server via HTTP at specified URL

#### Scenario: HTTP server with headers
- **WHEN** server config includes headers object
- **THEN** system includes those headers in HTTP requests

#### Scenario: Server stdio mode
- **WHEN** server config has type "stdio"
- **THEN** system communicates via stdin/stdout pipes

#### Scenario: Config format matches Claude Code
- **WHEN** config file is loaded
- **THEN** it uses mcpServers object with server-name keys containing type, command, args, url, headers, env fields

### Requirement: Gateway Configuration via CLI
The system SHALL configure gateway settings via CLI parameters and environment variables, not config file.

#### Scenario: Port via CLI parameter
- **WHEN** gateway command includes --port parameter
- **THEN** system uses that port (or random if 0 or omitted)

#### Scenario: Port via environment variable
- **WHEN** TOOLSCRIPT_PORT environment variable is set
- **THEN** system uses that value for gateway port (Note: TOOLSCRIPT_GATEWAY_URL is written by SessionStart hook after gateway starts)

### Requirement: Single Configuration File
The system SHALL use a single configuration file location.

#### Scenario: Default config location
- **WHEN** no --config flag is provided
- **THEN** system loads configuration from `./.toolscript.json`

#### Scenario: Explicit config path
- **WHEN** user specifies --config flag
- **THEN** system loads configuration from specified path

#### Scenario: No multi-level merging
- **WHEN** configuration is loaded
- **THEN** system uses only the single specified config file, no merging from multiple locations

### Requirement: Configuration Validation
The system SHALL validate configuration against schema before use.

#### Scenario: Valid configuration
- **WHEN** config matches required schema
- **THEN** system loads configuration successfully

#### Scenario: Missing required field
- **WHEN** config omits required server.command
- **THEN** system reports validation error specifying missing field

#### Scenario: Invalid field type
- **WHEN** config field has wrong type (e.g., port as string)
- **THEN** system reports type validation error

#### Scenario: Unknown fields
- **WHEN** config contains unrecognized fields
- **THEN** system logs warning but continues (forward compatibility)

### Requirement: Default Values
The system SHALL provide sensible defaults for optional server configuration.

#### Scenario: Default log level
- **WHEN** LOG_LEVEL environment variable is not set
- **THEN** system defaults to INFO level

### Requirement: Configuration Schema
The system SHALL define configuration structure with TypeScript types.

#### Scenario: Type-safe config loading
- **WHEN** configuration is loaded
- **THEN** system provides strongly-typed config object

#### Scenario: Schema documentation
- **WHEN** user requests config help
- **THEN** system displays example config

### Requirement: Environment Variable Support
The system SHALL support environment variables for gateway configuration.

#### Scenario: Gateway port via environment
- **WHEN** TOOLSCRIPT_PORT environment variable is set
- **THEN** system uses that value for gateway port (TOOLSCRIPT_GATEWAY_URL is written after gateway starts)

#### Scenario: Gateway URL for toolscript execution
- **WHEN** toolscript execution needs gateway access
- **THEN** system uses TOOLSCRIPT_GATEWAY_URL environment variable containing full URL (protocol, host, and port)

#### Scenario: Server environment variables
- **WHEN** server config references environment variables via ${VAR}
- **THEN** system substitutes values from environment


### Requirement: Secret Management
The system SHALL support secure handling of sensitive configuration.

#### Scenario: Environment variable references
- **WHEN** config uses ${VAR} syntax for sensitive values
- **THEN** system reads from environment without storing in config file

#### Scenario: No plaintext secrets
- **WHEN** config file is committed to git
- **THEN** secrets are not exposed (using env var references)

#### Scenario: Secret validation
- **WHEN** referenced environment variable is not set
- **THEN** system reports error when server attempts to start

### Requirement: Configuration Examples
The system SHALL provide example configurations for common scenarios.

#### Scenario: Example config format
- **WHEN** user needs config example
- **THEN** system provides example matching Claude Code format with mcpServers object

#### Scenario: Example with stdio server
- **WHEN** example config includes stdio server
- **THEN** includes type, command, args, and env fields with ${VAR} substitution examples

#### Scenario: Example with HTTP server
- **WHEN** example config includes HTTP server
- **THEN** includes type, url, headers with Authorization example

#### Scenario: Minimal config
- **WHEN** user wants simplest config
- **THEN** example shows minimal required fields: mcpServers object with one server containing type and command

### Requirement: Optional Configuration File
The system SHALL allow gateway to launch successfully even when no configuration file exists.

#### Scenario: Gateway launches with missing config
- **WHEN** no .toolscript.json config file exists
- **THEN** gateway starts successfully with zero MCP servers configured

#### Scenario: Empty tools module with no config
- **WHEN** gateway launches without config file
- **THEN** system generates empty tools module: export const tools = {}

#### Scenario: SessionStart succeeds without config
- **WHEN** SessionStart hook executes and no config file exists
- **THEN** hook successfully starts gateway without error

#### Scenario: Skill informs user about missing config
- **WHEN** skill is invoked and no config file exists
- **THEN** skill informs user they can create .toolscript.json to configure MCP servers

#### Scenario: Gateway serves empty HTTP endpoint without config
- **WHEN** gateway runs with no config and receives request to /runtime/tools.ts
- **THEN** gateway returns module with export const tools = {}
