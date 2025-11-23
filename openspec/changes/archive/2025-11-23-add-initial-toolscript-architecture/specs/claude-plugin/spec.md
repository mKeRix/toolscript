# Capability: Claude Plugin

## ADDED Requirements

### Requirement: Plugin Marketplace Structure
The plugin SHALL be located under the plugins/ directory in a marketplace structure.

#### Scenario: Plugin directory structure
- **WHEN** plugin is installed
- **THEN** plugin files are located under `plugins/toolscript/`

#### Scenario: Plugin manifest
- **WHEN** plugin is loaded
- **THEN** manifest is located at `plugins/toolscript/.claude-plugin/plugin.json`

#### Scenario: Marketplace organization
- **WHEN** repository structure is examined
- **THEN** plugins/ directory contains Claude plugins, src/ contains CLI tool source

### Requirement: Single Toolscript Skill
The plugin SHALL provide a single skill using progressive disclosure pattern.

#### Scenario: Lean skill file
- **WHEN** LLM loads toolscript skill
- **THEN** skill file at `plugins/toolscript/skills/toolscript/SKILL.md` contains minimal core instructions with references to detailed content

#### Scenario: Progressive disclosure
- **WHEN** skill references detailed content
- **THEN** detailed content is organized in `plugins/toolscript/skills/toolscript/references/` directory

#### Scenario: Skill operations
- **WHEN** LLM invokes toolscript skill
- **THEN** skill supports discovery operations (list servers, tools, types) and execution operations

#### Scenario: List all servers
- **WHEN** LLM requests server list via skill
- **THEN** system returns list of configured MCP servers

#### Scenario: List tools for server
- **WHEN** LLM requests tools for specific server via skill
- **THEN** system returns tool names and descriptions

#### Scenario: Get tool types
- **WHEN** LLM requests TypeScript types for tool via skill
- **THEN** system returns generated type definitions

#### Scenario: Execute inline code
- **WHEN** LLM provides TypeScript code via skill
- **THEN** system executes code in sandbox and returns result

#### Scenario: Execute with imports
- **WHEN** LLM code imports from configured servers
- **THEN** system provides type-safe access to MCP tools with namespaced function names

#### Scenario: Capture output
- **WHEN** toolscript produces console output
- **THEN** system returns both stdout and stderr to LLM

#### Scenario: Handle errors
- **WHEN** toolscript throws error
- **THEN** system returns error message and stack trace to LLM

### Requirement: SessionStart Hook
The plugin SHALL provide a hook that starts gateway in background on session start.

#### Scenario: Hook registration
- **WHEN** plugin is loaded
- **THEN** SessionStart hook is registered in `plugins/toolscript/hooks/hooks.json`

#### Scenario: Hook script location
- **WHEN** SessionStart hook executes
- **THEN** script is located at `plugins/toolscript/hooks/session-start.sh`

#### Scenario: Start gateway in background
- **WHEN** Claude Code session starts
- **THEN** hook executes `toolscript gateway start` in background and manages the background process

#### Scenario: Allocate random port
- **WHEN** SessionStart hook starts gateway
- **THEN** hook either passes random port via CLI parameter or lets gateway choose, then captures actual port

#### Scenario: Write PID file
- **WHEN** gateway starts successfully
- **THEN** hook writes PID file containing only the process ID

#### Scenario: Write gateway URL to env
- **WHEN** gateway starts successfully
- **THEN** hook writes TOOLSCRIPT_GATEWAY_URL (full URL with protocol and port) to environment variable for discovery

#### Scenario: Gateway already running
- **WHEN** SessionStart hook runs with gateway already active
- **THEN** hook reuses existing gateway if same session_id

#### Scenario: Gateway startup failure
- **WHEN** gateway fails to start
- **THEN** hook logs error and session continues without toolscript

#### Scenario: SessionStart with no config file
- **WHEN** SessionStart hook executes and no .toolscript.json exists
- **THEN** hook starts gateway successfully with zero servers configured

### Requirement: SessionEnd Hook
The plugin SHALL provide a hook that kills gateway process on session end and cleans up resources.

#### Scenario: Hook registration
- **WHEN** plugin is loaded
- **THEN** SessionEnd hook is registered in `plugins/toolscript/hooks/hooks.json`

#### Scenario: Hook script location
- **WHEN** SessionEnd hook executes
- **THEN** script is located at `plugins/toolscript/hooks/session-end.sh`

#### Scenario: Read PID file
- **WHEN** Claude Code session ends
- **THEN** hook reads PID file to get gateway process ID

#### Scenario: Kill gateway process
- **WHEN** SessionEnd hook has valid PID
- **THEN** hook kills the gateway process (via kill command or similar)

#### Scenario: Cleanup PID file
- **WHEN** gateway process is killed
- **THEN** hook removes PID file for session

#### Scenario: Gateway not running
- **WHEN** SessionEnd hook runs with no active gateway
- **THEN** hook completes silently without error

#### Scenario: Force cleanup on stale PID
- **WHEN** PID file exists but process is dead
- **THEN** hook cleans up stale PID file

### Requirement: Skill Documentation
The plugin SHALL provide clear, lean documentation using progressive disclosure.

#### Scenario: Skill description
- **WHEN** LLM views available skills
- **THEN** skill has clear, concise description of capabilities

#### Scenario: Core content is lean
- **WHEN** skill file is loaded
- **THEN** core skill file contains only essential instructions

#### Scenario: Detailed content in references
- **WHEN** LLM needs detailed information
- **THEN** skill references point to detailed documentation in references/ directory

#### Scenario: Usage examples
- **WHEN** skill documentation is displayed
- **THEN** includes example invocations and expected outputs

#### Scenario: When to use guidance
- **WHEN** skill documentation is displayed
- **THEN** includes guidance on when to use the skill

### Requirement: Session Isolation
The plugin SHALL ensure gateway instances are isolated per session.

#### Scenario: Multiple sessions
- **WHEN** multiple Claude sessions are active
- **THEN** each session has independent gateway instance

#### Scenario: Session ID tracking
- **WHEN** gateway starts
- **THEN** system associates with current SESSION_ID

#### Scenario: Prevent cross-session access
- **WHEN** toolscript executes in one session
- **THEN** system cannot access gateways from other sessions

### Requirement: Error Recovery
The plugin SHALL handle failures gracefully.

#### Scenario: Gateway crash handling
- **WHEN** gateway process crashes mid-session
- **THEN** skill reports unhealthy gateway status to user without attempting restart

#### Scenario: Configuration errors
- **WHEN** configuration is invalid
- **THEN** skills report actionable error to LLM

#### Scenario: Network errors
- **WHEN** gateway is unreachable
- **THEN** skills report unhealthy gateway status and suggest manual restart

### Requirement: Performance Optimization
The plugin SHALL optimize for LLM interaction efficiency.

#### Scenario: Gateway runs entire session
- **WHEN** Claude Code session starts
- **THEN** gateway starts and runs for entire session duration, no lazy loading

#### Scenario: Types pre-generated
- **WHEN** gateway starts
- **THEN** all types are pre-generated, no on-demand generation during toolscript execution

#### Scenario: Instant type access
- **WHEN** LLM requests types via skill
- **THEN** system returns pre-generated types immediately


### Requirement: Logging and Debugging
The plugin SHALL provide logging for troubleshooting.

#### Scenario: Hook execution logging
- **WHEN** hooks execute
- **THEN** system logs to stdout/stderr

#### Scenario: Skill invocation logging
- **WHEN** skills are invoked
- **THEN** system logs to stdout/stderr

#### Scenario: Debug mode
- **WHEN** DEBUG environment variable is set
- **THEN** system logs additional diagnostic information to stdout/stderr

### Requirement: Configuration Feedback
The plugin SHALL help users configure servers correctly.

#### Scenario: Missing config information
- **WHEN** skill is invoked and no config file exists
- **THEN** skill informs user they can create .toolscript.json to configure MCP servers

#### Scenario: Skill works without config
- **WHEN** skill is invoked with no config file
- **THEN** skill operations work with empty server list (list-servers returns empty, exec works with empty tools)

#### Scenario: Invalid server config
- **WHEN** server fails to start
- **THEN** skills report specific configuration issue

#### Scenario: Server connectivity test
- **WHEN** LLM requests server status
- **THEN** skill tests connectivity and reports health

### Requirement: Skill Composition
The plugin SHALL support combining multiple skill invocations.

#### Scenario: Discover then execute
- **WHEN** LLM first discovers tools then writes toolscript
- **THEN** execution skill has access to discovered types

#### Scenario: Iterative development
- **WHEN** LLM executes, sees error, and revises code
- **THEN** each execution is independent with clean sandbox

#### Scenario: Multi-step workflows
- **WHEN** LLM executes multiple toolscripts in sequence
- **THEN** each execution can access results from previous ones via return values
