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
The CLI SHALL provide a `get-types` command that fetches and outputs TypeScript type definitions and usage examples from gateway HTTP endpoint in Markdown format.

#### Scenario: Fetch types from gateway HTTP endpoint
- **WHEN** user runs `toolscript get-types github create_issue`
- **THEN** system fetches module from gateway at ${TOOLSCRIPT_GATEWAY_URL}/runtime/tools.ts?server=github&tool=createIssue and displays filtered types

#### Scenario: Get types for all tools in server
- **WHEN** user runs `toolscript get-types github`
- **THEN** system fetches module from gateway HTTP endpoint with ?server=github query parameter

#### Scenario: Use query parameters for filtering
- **WHEN** types command requests specific server or tool
- **THEN** system uses query parameters server and tool to filter generated module at HTTP endpoint

#### Scenario: Markdown output format with clean import
- **WHEN** types command executes
- **THEN** first code block contains TypeScript type definitions, second code block shows clean import syntax and camelCase tool calls

#### Scenario: Clean import example in output
- **WHEN** types command generates usage example
- **THEN** example shows import { tools } from "toolscript" and tools.github.createIssue() syntax

#### Scenario: No config file for types
- **WHEN** user runs `toolscript get-types github` with no config file
- **THEN** system displays error indicating server not found (zero servers configured)

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

