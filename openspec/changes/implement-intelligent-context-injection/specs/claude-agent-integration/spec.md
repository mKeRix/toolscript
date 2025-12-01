# claude-agent-integration Specification

## Purpose

Provide a clean TypeScript wrapper around the Claude Agent SDK for intelligent skill and tool suggestion within the toolscript CLI, configured for single-turn, tool-free text generation optimized for classification tasks.

## ADDED Requirements

### Requirement: Agent SDK Dependency
The system SHALL use the official Claude Agent SDK for Claude API integration.

#### Scenario: Deno package dependency
- **WHEN** project dependencies are installed
- **THEN** `@anthropic-ai/claude-agent-sdk` is included in deno.json imports

#### Scenario: TypeScript SDK usage
- **WHEN** agent integration is implemented
- **THEN** TypeScript SDK is used (not Python SDK)

#### Scenario: SDK version tracking
- **WHEN** SDK is updated
- **THEN** version constraints follow semantic versioning (e.g., `^1.0.0`)

### Requirement: Query Function Wrapper
The system SHALL provide a TypeScript function that wraps the Agent SDK query function for skill/tool suggestion tasks.

#### Scenario: Function signature
- **WHEN** suggestion function is called
- **THEN** function accepts parameters: `userPrompt: string`, `skills: Array<{name: string, description: string}>`

#### Scenario: Return type
- **WHEN** suggestion function completes
- **THEN** function returns `Promise<{skills: string[], toolQueries: string[]}>` for internal processing

#### Scenario: Model selection
- **WHEN** Agent SDK query is created
- **THEN** model is set to `"haiku"` to use the user's configured model for this category

### Requirement: Configuration Sources
The agent wrapper SHALL load settings from all three Claude Agent SDK config sources.

#### Scenario: User-level settings
- **WHEN** Agent SDK query is created
- **THEN** `settingSources` includes "user" for `~/.claude/settings.json`

#### Scenario: Project-level settings
- **WHEN** Agent SDK query is created
- **THEN** `settingSources` includes "project" for `.claude/settings.json`

#### Scenario: Local settings
- **WHEN** Agent SDK query is created
- **THEN** `settingSources` includes "local" for `.claude/local/*.md`

### Requirement: Custom System Prompt
The agent wrapper SHALL use a custom system prompt specific to skill/tool suggestion, not Claude Code's default.

#### Scenario: System prompt content
- **WHEN** Agent SDK query is created
- **THEN** `systemPrompt` instructs the model to act as a skill/tool classifier

#### Scenario: JSON output instruction
- **WHEN** system prompt is set
- **THEN** prompt explicitly requests JSON output format with specific schema

#### Scenario: No default prompt
- **WHEN** Agent SDK query is created
- **THEN** Claude Code's default system prompt is not used

### Requirement: Tool-Free Execution
The agent SHALL execute without access to any tools for security and performance.

#### Scenario: Empty tool list
- **WHEN** Agent SDK query is created
- **THEN** `allowedTools` option is set to empty array `[]`

#### Scenario: No MCP servers
- **WHEN** Agent SDK query is created
- **THEN** `mcpServers` option is not provided or is empty object `{}`

#### Scenario: Pure text generation
- **WHEN** agent executes
- **THEN** agent only returns text response without tool calls

### Requirement: Single Turn Execution
The agent SHALL execute exactly one turn and return immediately.

#### Scenario: Single iteration
- **WHEN** Agent SDK query stream is consumed
- **THEN** wrapper iterates once and returns first assistant message

#### Scenario: No follow-up
- **WHEN** agent response is received
- **THEN** wrapper does not send additional messages or prompts

#### Scenario: Stream completion
- **WHEN** agent response ends
- **THEN** wrapper exits iteration and returns result

### Requirement: Timeout Protection
The agent call SHALL be protected by a timeout to prevent hanging.

#### Scenario: Timeout duration
- **WHEN** agent query executes
- **THEN** wrapper aborts after 5 seconds using AbortSignal

#### Scenario: Timeout error handling
- **WHEN** timeout is reached
- **THEN** wrapper throws timeout error that caller can catch

#### Scenario: Cleanup on timeout
- **WHEN** timeout occurs
- **THEN** wrapper properly cleans up resources and connections

### Requirement: Response Parsing
The wrapper SHALL parse and validate LLM responses to extract structured data.

#### Scenario: JSON extraction
- **WHEN** LLM returns text response
- **THEN** wrapper extracts JSON from response (handling markdown code fences)

#### Scenario: Schema validation
- **WHEN** JSON is parsed
- **THEN** wrapper validates required fields: `skills` (array), `toolQueries` (array)

#### Scenario: Array type validation
- **WHEN** response fields are validated
- **THEN** `skills` and `toolQueries` are confirmed to be arrays of strings

#### Scenario: Malformed response
- **WHEN** response is not valid JSON or missing required fields
- **THEN** wrapper throws descriptive error with parsing details

#### Scenario: Empty arrays are valid
- **WHEN** LLM returns empty skills/queries
- **THEN** wrapper accepts `{"skills": [], "toolQueries": []}`

### Requirement: Error Handling
The wrapper SHALL handle all error conditions gracefully with informative messages.

#### Scenario: Network errors
- **WHEN** API request fails due to network issue
- **THEN** wrapper throws error indicating network problem

#### Scenario: API errors
- **WHEN** Claude API returns error response
- **THEN** wrapper throws error with API error message and status code

#### Scenario: Rate limiting
- **WHEN** API returns 429 status
- **THEN** wrapper throws error indicating rate limit exceeded

#### Scenario: Authentication errors
- **WHEN** API returns 401 status
- **THEN** wrapper throws error indicating invalid API key

#### Scenario: Error message formatting
- **WHEN** any error occurs
- **THEN** error message includes context about what operation failed

### Requirement: Prompt Engineering
The wrapper SHALL construct effective prompts for skill/tool classification.

#### Scenario: Prompt template
- **WHEN** wrapper builds LLM prompt
- **THEN** prompt includes user's original prompt, available skills list, and instructions

#### Scenario: Skill list formatting
- **WHEN** skills are included in prompt
- **THEN** each skill is formatted as "- skill-name: description"

#### Scenario: Output format instruction
- **WHEN** prompt is constructed
- **THEN** prompt explicitly requests JSON format with schema example

#### Scenario: Zero-match handling
- **WHEN** prompt is constructed
- **THEN** prompt explicitly allows returning empty arrays when nothing is relevant

### Requirement: Type Safety
The wrapper SHALL use TypeScript for compile-time type safety.

#### Scenario: Input types
- **WHEN** wrapper function is called
- **THEN** TypeScript enforces types for userPrompt (string) and skills (array of objects)

#### Scenario: Return type
- **WHEN** wrapper function completes
- **THEN** TypeScript enforces return type matching the expected schema

#### Scenario: Error types
- **WHEN** wrapper throws errors
- **THEN** errors are typed (e.g., `ApiError`, `TimeoutError`, `ValidationError`)

#### Scenario: Agent SDK types
- **WHEN** Agent SDK is used
- **THEN** wrapper imports and uses SDK's TypeScript type definitions
