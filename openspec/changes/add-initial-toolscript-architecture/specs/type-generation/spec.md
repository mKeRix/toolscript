# Capability: Type Generation

## ADDED Requirements

### Requirement: OpenAPI Conversion
The type generator SHALL convert MCP tool schemas to OpenAPI 3.0 format.

#### Scenario: Input schema conversion
- **WHEN** MCP tool defines inputSchema
- **THEN** system converts to OpenAPI requestBody schema

#### Scenario: Output schema conversion
- **WHEN** MCP tool defines output type
- **THEN** system converts to OpenAPI response schema

#### Scenario: Schema references
- **WHEN** schema contains $ref to shared definitions
- **THEN** system resolves and includes referenced schemas

#### Scenario: Primitive types
- **WHEN** schema uses string, number, boolean, null
- **THEN** system maps to equivalent OpenAPI types

#### Scenario: Complex types
- **WHEN** schema uses objects, arrays, or unions
- **THEN** system preserves structure in OpenAPI format

### Requirement: TypeScript Type Generation
The type generator SHALL use openapi-typescript to generate type definitions.

#### Scenario: Generate types from OpenAPI
- **WHEN** OpenAPI schema is available
- **THEN** system invokes openapi-typescript to generate .d.ts file

#### Scenario: Server-level types
- **WHEN** generating types for entire server
- **THEN** system creates namespace with all tool types

#### Scenario: Tool-level types
- **WHEN** generating types for specific tool
- **THEN** system creates focused type definitions for that tool

#### Scenario: Type naming
- **WHEN** generating TypeScript types
- **THEN** system uses PascalCase for type names and camelCase for properties

### Requirement: Name Validation and Conversion
The type generator SHALL validate and convert server names and tool names to valid JavaScript/TypeScript identifiers following camelCase for functions and namespaces, PascalCase for types.

#### Scenario: Convert snake_case to camelCase for functions
- **WHEN** tool name is snake_case (e.g., "create_issue")
- **THEN** system converts to camelCase (e.g., "createIssue")

#### Scenario: Convert hyphens to camelCase for functions
- **WHEN** tool name contains hyphens (e.g., "create-issue")
- **THEN** system converts to camelCase (e.g., "createIssue")

#### Scenario: Convert snake_case to camelCase for namespaces
- **WHEN** server name is snake_case (e.g., "my_server")
- **THEN** namespace is camelCase (e.g., "myServer")

#### Scenario: Convert hyphens to camelCase for namespaces
- **WHEN** server name contains hyphens (e.g., "github-api")
- **THEN** namespace is camelCase (e.g., "githubApi")

#### Scenario: Preserve existing camelCase
- **WHEN** name is already camelCase (e.g., "createIssue")
- **THEN** system uses name as-is without modification

#### Scenario: Handle names starting with numbers
- **WHEN** server or tool name starts with a number (e.g., "123server")
- **THEN** system prefixes with underscore (e.g., "_123server")

#### Scenario: Remove invalid characters
- **WHEN** name contains characters invalid in JavaScript identifiers (not alphanumeric or underscore)
- **THEN** system removes them to create valid identifier

#### Scenario: Collapse multiple underscores or hyphens
- **WHEN** name contains multiple consecutive underscores or hyphens (e.g., "create__issue")
- **THEN** system collapses to single separator before converting to camelCase (e.g., "createIssue")

### Requirement: In-Memory Type Caching
The type generator SHALL cache generated types in memory only for the lifetime of the current gateway instance.

#### Scenario: In-memory cache only
- **WHEN** gateway starts and generates types
- **THEN** system caches types in memory for the current instance, no file-based cache

#### Scenario: Instance-scoped cache
- **WHEN** types are cached
- **THEN** cache is scoped to the current gateway process only

#### Scenario: Cache cleared on shutdown
- **WHEN** gateway stops
- **THEN** in-memory cache is cleared and not persisted to disk

### Requirement: TypeScript Naming Conventions
The type generator SHALL follow TypeScript naming conventions for all generated code.

#### Scenario: Function names in camelCase from snake_case
- **WHEN** generating function for tool with snake_case name (e.g., "create_issue")
- **THEN** system converts to camelCase (e.g., "createIssue")

#### Scenario: Function names in camelCase from hyphens
- **WHEN** generating function for tool with hyphens (e.g., "get-user-profile")
- **THEN** system converts to camelCase (e.g., "getUserProfile")

#### Scenario: Type names in PascalCase
- **WHEN** generating parameter or return types
- **THEN** system uses PascalCase combining server and tool name (e.g., GithubCreateIssueParams, GithubCreateIssueResult)

#### Scenario: Namespace objects in camelCase from snake_case
- **WHEN** generating server namespace for "my_server"
- **THEN** system uses camelCase (e.g., tools.myServer)

#### Scenario: Namespace objects in camelCase from hyphens
- **WHEN** generating server namespace for "github-api"
- **THEN** system uses camelCase (e.g., tools.githubApi)

#### Scenario: Type naming with PascalCase conversion
- **WHEN** generating types for server "my-api-server" and tool "get_user"
- **THEN** parameter type is MyApiServerGetUserParams and return type is MyApiServerGetUserResult (both parts converted to PascalCase)

#### Scenario: Leading numbers in identifiers
- **WHEN** server or tool starts with number (e.g., "123test")
- **THEN** system prefixes with underscore (e.g., "_123test" for function, "_123Test" for type component)

### Requirement: Client Code Generation
The type generator SHALL generate executable client code with clean nested object syntax for MCP tool invocation.

#### Scenario: Function wrapper generation with nested object access
- **WHEN** generating client for tool
- **THEN** system creates async function with typed parameters accessible via nested object (e.g., tools.github.createIssue())

#### Scenario: Clean tool call syntax with camelCase functions
- **WHEN** generated client provides tool access
- **THEN** tools are accessible via camelCase nested objects like tools.github.createIssue() not tools['github__create_issue']()

#### Scenario: Server namespacing with camelCase
- **WHEN** multiple servers are configured
- **THEN** each server's tools are grouped under camelCase server name object (e.g., tools.github.*, tools.atlassian.*)

#### Scenario: HTTP request construction
- **WHEN** client function is called
- **THEN** generated code constructs proper HTTP request to gateway with double-underscore namespaced tool name (e.g., github__create_issue)

#### Scenario: Response deserialization
- **WHEN** gateway returns response
- **THEN** generated code parses and returns typed result

#### Scenario: Error handling
- **WHEN** request fails
- **THEN** generated code throws typed error with details

### Requirement: HTTP Module Serving
The type generator SHALL serve generated TypeScript module via HTTP endpoint for Deno HTTP imports with import map resolution.

#### Scenario: Serve module via HTTP
- **WHEN** toolscript imports from gateway HTTP endpoint
- **THEN** gateway serves generated TypeScript module with Content-Type: application/typescript

#### Scenario: HTTP endpoint path
- **WHEN** toolscript imports tools
- **THEN** import URL is ${TOOLSCRIPT_GATEWAY_URL}/runtime/tools.ts (resolved via import map from "toolscript")

#### Scenario: Module caching at gateway
- **WHEN** gateway generates tools module
- **THEN** system caches module in memory for subsequent HTTP requests

#### Scenario: Regenerate on server changes
- **WHEN** MCP server reconnects or tools change
- **THEN** gateway regenerates and caches updated module

#### Scenario: Multiple servers in HTTP module
- **WHEN** multiple servers configured
- **THEN** HTTP module exports tools object with all servers as camelCase properties (e.g., export const tools = { github: {...}, atlassian: {...} })

#### Scenario: Import resolution via clean import syntax
- **WHEN** toolscript uses import { tools } from "toolscript"
- **THEN** Deno resolves "toolscript" via import map to HTTP URL and fetches module from gateway HTTP endpoint

#### Scenario: Empty tools module
- **WHEN** no MCP servers are configured
- **THEN** generated module exports empty tools object: export const tools = {}

#### Scenario: Filter module by server
- **WHEN** HTTP endpoint receives ?server=github query parameter
- **THEN** generated module includes only tools from github server

#### Scenario: Filter module by server and tool
- **WHEN** HTTP endpoint receives ?server=github&tool=createIssue query parameters
- **THEN** generated module includes only the createIssue tool from github server

#### Scenario: No filtering returns all
- **WHEN** HTTP endpoint receives no query parameters
- **THEN** generated module includes all tools from all servers

### Requirement: Type Documentation
The type generator SHALL preserve documentation from MCP schemas.

#### Scenario: JSDoc comments
- **WHEN** MCP tool has description
- **THEN** generated types include JSDoc with description

#### Scenario: Parameter descriptions
- **WHEN** input schema has property descriptions
- **THEN** generated types include JSDoc for each parameter

#### Scenario: Example values
- **WHEN** schema includes examples
- **THEN** generated JSDoc includes @example tags

### Requirement: Schema Validation
The type generator SHALL validate MCP schemas before conversion.

#### Scenario: Valid schema
- **WHEN** MCP schema is well-formed
- **THEN** system proceeds with type generation

#### Scenario: Invalid schema
- **WHEN** MCP schema is malformed or invalid
- **THEN** system reports validation error with details

#### Scenario: Missing required fields
- **WHEN** schema omits required inputSchema property
- **THEN** system reports error indicating missing field

### Requirement: Pre-Generation at Startup
The type generator SHALL pre-generate all types when the gateway starts.

#### Scenario: Full generation at startup
- **WHEN** gateway starts
- **THEN** system generates types for all tools from all configured servers

#### Scenario: Types available immediately
- **WHEN** toolscript needs to import tool types
- **THEN** all types are already generated and available

### Requirement: Type Safety
The type generator SHALL ensure compile-time type safety for tool parameters.

#### Scenario: Required parameters
- **WHEN** tool defines required parameters
- **THEN** generated function signature requires those parameters

#### Scenario: Optional parameters
- **WHEN** tool defines optional parameters
- **THEN** generated function signature marks them as optional

#### Scenario: Parameter validation
- **WHEN** incorrect parameter type is used
- **THEN** TypeScript compiler reports type error

#### Scenario: Return type inference
- **WHEN** tool specifies output schema
- **THEN** generated function has inferred return type

#### Scenario: Generic output type for tools without schema
- **WHEN** tool does not define output schema
- **THEN** generated function uses Promise<unknown> as return type

### Requirement: Error Reporting
The type generator SHALL provide actionable errors for generation failures.

#### Scenario: Conversion error
- **WHEN** schema cannot be converted to OpenAPI
- **THEN** system reports specific conversion issue with schema path

#### Scenario: Generation error
- **WHEN** openapi-typescript fails
- **THEN** system reports underlying error from type generator

#### Scenario: Cache miss
- **WHEN** requested types are not in memory cache
- **THEN** system generates types and stores in memory
