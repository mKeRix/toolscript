# toolscript-execution Specification

## Purpose
TBD - created by archiving change add-initial-toolscript-architecture. Update Purpose after archive.
## Requirements
### Requirement: Sandbox Environment
The execution engine SHALL run toolscripts in sandboxed Deno processes.

#### Scenario: Isolated execution
- **WHEN** toolscript executes
- **THEN** system runs code in separate Deno process with restricted permissions

#### Scenario: Network restrictions
- **WHEN** toolscript attempts network access
- **THEN** system only allows connections to gateway server URL

#### Scenario: Filesystem restrictions
- **WHEN** toolscript attempts filesystem access
- **THEN** system denies read/write operations (no --allow-read/--allow-write)

#### Scenario: Environment variable restrictions
- **WHEN** toolscript accesses environment
- **THEN** system only provides TOOLSCRIPT_GATEWAY_URL variable

### Requirement: TypeScript Support
The execution engine SHALL support TypeScript syntax and features.

#### Scenario: TypeScript compilation
- **WHEN** toolscript uses TypeScript syntax
- **THEN** system compiles and executes successfully

#### Scenario: Type checking
- **WHEN** toolscript has type errors
- **THEN** system reports compilation errors before execution

#### Scenario: ES modules
- **WHEN** toolscript uses import/export
- **THEN** system resolves module dependencies

### Requirement: Top-Level Await
The execution engine SHALL support top-level await in toolscripts.

#### Scenario: Top-level await
- **WHEN** toolscript uses await at top level
- **THEN** system executes async code without wrapper function

#### Scenario: Promise handling
- **WHEN** toolscript returns Promise
- **THEN** system awaits resolution before returning result

### Requirement: Import Map Generation
The execution engine SHALL generate a Deno import map dynamically to enable clean imports with cache busting.

#### Scenario: Generate import map JSON
- **WHEN** toolscript execution starts
- **THEN** system generates import map JSON mapping "toolscript" to gateway HTTP URL from TOOLSCRIPT_GATEWAY_URL

#### Scenario: Import map structure with cache busting
- **WHEN** import map is generated
- **THEN** JSON contains imports object mapping "toolscript" to "${TOOLSCRIPT_GATEWAY_URL}/runtime/tools.ts?_t=${timestamp}"

#### Scenario: Cache busting timestamp
- **WHEN** import map URL is generated
- **THEN** system appends _t query parameter with current timestamp or session ID

#### Scenario: Ensure fresh types on gateway restart
- **WHEN** gateway restarts or tools change
- **THEN** cache busting parameter forces Deno to fetch fresh module instead of using cached version

#### Scenario: Write import map to temp file
- **WHEN** import map is generated
- **THEN** system writes JSON to temporary file for Deno to consume

#### Scenario: Launch Deno with import map flag
- **WHEN** executing toolscript
- **THEN** system launches Deno with --import-map flag pointing to generated import map file

### Requirement: HTTP Import Support
The execution engine SHALL enable toolscripts to import tools via clean import syntax using import maps.

#### Scenario: Clean import syntax
- **WHEN** toolscript uses import { tools } from "toolscript"
- **THEN** Deno resolves "toolscript" via import map to HTTP URL and fetches TypeScript module from gateway

#### Scenario: TOOLSCRIPT_GATEWAY_URL environment variable
- **WHEN** toolscript needs gateway URL
- **THEN** system provides TOOLSCRIPT_GATEWAY_URL environment variable set by SessionStart hook

#### Scenario: Type-safe HTTP imports
- **WHEN** toolscript imports tools using clean import syntax
- **THEN** TypeScript provides autocomplete and type checking for all server tools

#### Scenario: Multiple servers via clean import
- **WHEN** multiple servers are configured
- **THEN** toolscript can access all servers via tools object (e.g., import { tools } from "toolscript"; tools.github.createIssue())

#### Scenario: Server namespacing with camelCase
- **WHEN** toolscript imports tools using clean import
- **THEN** system provides tools object with camelCase nested server access (e.g., tools.github.createIssue())

### Requirement: Output Handling
The execution engine SHALL capture and route toolscript output correctly.

#### Scenario: Return value to stdout
- **WHEN** toolscript returns value
- **THEN** system serializes value to JSON and writes to stdout

#### Scenario: Console.log to stdout
- **WHEN** toolscript calls `console.log()`
- **THEN** system writes output to stdout

#### Scenario: Console.error to stderr
- **WHEN** toolscript calls `console.error()`
- **THEN** system writes output to stderr

### Requirement: Error Handling
The execution engine SHALL capture and report errors clearly.

#### Scenario: Runtime error
- **WHEN** toolscript throws error during execution
- **THEN** system captures error, stack trace, and exits with code 1

#### Scenario: Syntax error
- **WHEN** toolscript has syntax errors
- **THEN** system reports compilation error without executing

#### Scenario: Type error
- **WHEN** toolscript has TypeScript type errors
- **THEN** system reports type errors during compilation

#### Scenario: Uncaught promise rejection
- **WHEN** toolscript has unhandled promise rejection
- **THEN** system captures and reports rejection as error

### Requirement: Gateway Communication
The execution engine SHALL provide seamless MCP tool invocation via gateway using clean nested object syntax with camelCase naming.

#### Scenario: Tool invocation with camelCase syntax
- **WHEN** toolscript calls tool via nested object (e.g., tools.github.createIssue())
- **THEN** generated client sends HTTP request to gateway with double-underscore namespaced tool name (github__create_issue)

#### Scenario: Multiple servers with camelCase namespacing
- **WHEN** toolscript calls tools from different servers
- **THEN** each call uses camelCase syntax like tools.github.createIssue() and tools.atlassian.getIssue()

#### Scenario: Response parsing
- **WHEN** gateway returns tool result
- **THEN** generated client deserializes response and returns to toolscript

#### Scenario: Error propagation
- **WHEN** gateway returns error
- **THEN** generated client throws exception in toolscript with error details

#### Scenario: Multiple tool calls
- **WHEN** toolscript calls multiple tools sequentially
- **THEN** system executes each call in order and returns results

### Requirement: Execution Context
The execution engine SHALL provide minimal runtime context to toolscripts.

#### Scenario: Gateway URL access
- **WHEN** toolscript accesses TOOLSCRIPT_GATEWAY_URL
- **THEN** system provides gateway full URL for constructing HTTP import URL

#### Scenario: Working directory
- **WHEN** toolscript checks current directory
- **THEN** system reports directory from which toolscript was invoked

#### Scenario: No metadata injection
- **WHEN** toolscript execution environment is set up
- **THEN** system does not inject metadata like versions, timestamps, or other extraneous information

