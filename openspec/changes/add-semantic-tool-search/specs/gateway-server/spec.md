# Gateway Server Type Filtering Enhancement

## ADDED Requirements

None - this spec only modifies existing gateway server functionality.

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Type Filtering (Old Query Parameters)
The gateway's existing server/tool query parameter filtering **MUST** be removed and replaced with the filter parameter.

#### Scenario: Old server parameter no longer supported
**WHEN** client requests GET `/runtime/tools.ts?server=github`
**THEN** gateway returns error response indicating parameter not supported
**AND** error message suggests using `filter=github` instead

#### Scenario: Old tool parameter no longer supported
**WHEN** client requests GET `/runtime/tools.ts?server=github&tool=createIssue`
**THEN** gateway returns error response indicating parameters not supported
**AND** error message suggests using `filter=github__createIssue` instead

#### Scenario: Tool filter without server (old behavior)
**WHEN** client requests GET `/runtime/tools.ts?tool=createIssue`
**THEN** gateway returns error indicating this parameter combination is no longer supported
