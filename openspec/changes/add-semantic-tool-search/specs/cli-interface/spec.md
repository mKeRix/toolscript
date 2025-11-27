# CLI Interface Get-Types Command Enhancement

## ADDED Requirements

None - this spec only modifies the existing get-types command.

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Get Types Command (Old Parameter Format)
The CLI's get-types command **MUST** remove support for the old positional server/tool arguments.

#### Scenario: Old server parameter no longer supported
**WHEN** user runs `toolscript get-types github`
**THEN** system displays error message indicating this syntax is no longer supported
**AND** suggests using `--filter github` instead

#### Scenario: Old server and tool parameters no longer supported
**WHEN** user runs `toolscript get-types github create_issue`
**THEN** system displays error message indicating this syntax is no longer supported
**AND** suggests using `--filter github__create_issue` instead
