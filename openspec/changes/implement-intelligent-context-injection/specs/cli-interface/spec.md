# cli-interface Spec Delta

## ADDED Requirements

### Requirement: Claude Usage Suggestion Command
The CLI SHALL provide a command under the context group for LLM-based usage suggestion tailored for Claude Code hooks.

#### Scenario: Command naming and grouping
- **WHEN** user executes context suggestion command
- **THEN** command is `toolscript context claude-usage-suggestion` under the context subcommand group

#### Scenario: Accept user prompt
- **WHEN** `toolscript context claude-usage-suggestion` is invoked with `--prompt` flag
- **THEN** command receives the user's prompt text for analysis

#### Scenario: Accept gateway URL
- **WHEN** command is invoked with `--gateway-url` flag
- **THEN** command receives the gateway URL for MCP tool search

#### Scenario: Output hook JSON response
- **WHEN** command completes successfully
- **THEN** output is valid hook JSON response: `{"hookSpecificOutput":{"additionalContext":"..."}}`

#### Scenario: Scan global skills directory
- **WHEN** command executes
- **THEN** command scans `~/.claude/skills/*/SKILL.md` for globally installed skills

#### Scenario: Scan project skills directory
- **WHEN** command executes
- **THEN** command scans `.claude/skills/*/SKILL.md` for project-specific skills

#### Scenario: Scan installed plugins
- **WHEN** command executes
- **THEN** command reads `~/.claude/plugins/installed_plugins.json` to discover all installed plugins

#### Scenario: Discover skills from all plugins
- **WHEN** plugin paths are known
- **THEN** command scans `{plugin_path}/skills/*/SKILL.md` for each plugin to find available skills

#### Scenario: Extract skill descriptions
- **WHEN** SKILL.md file is read
- **THEN** command parses YAML frontmatter to extract `description` field for each skill

#### Scenario: Handle missing directories
- **WHEN** a skills directory doesn't exist
- **THEN** command continues scanning other locations without failing

#### Scenario: Handle malformed SKILL.md
- **WHEN** SKILL.md has invalid YAML frontmatter
- **THEN** command logs warning and skips that skill, continues processing others

#### Scenario: Use Claude Agent SDK
- **WHEN** command needs to evaluate prompt relevance
- **THEN** command uses `@anthropic-ai/claude-agent-sdk` query function to call Claude API

#### Scenario: Configure Haiku model
- **WHEN** Agent SDK query is created
- **THEN** model is set to "haiku" to use user's configured model for this category

#### Scenario: Load SDK config sources
- **WHEN** Agent SDK query is created
- **THEN** `settingSources` includes ["user", "project", "local"] for full config support

#### Scenario: Disable tools for agent
- **WHEN** Agent SDK query is created
- **THEN** `allowedTools` is set to empty array (no tools needed for text generation)

#### Scenario: Custom system prompt
- **WHEN** Agent SDK query is created
- **THEN** `systemPrompt` is provided with custom instructions (not Claude Code's default)

#### Scenario: Single turn execution
- **WHEN** Agent SDK query executes
- **THEN** command iterates once through response and returns first assistant message

#### Scenario: Timeout protection
- **WHEN** LLM call takes too long
- **THEN** command aborts after 5 seconds and returns empty suggestions

#### Scenario: API error handling
- **WHEN** Claude API returns error response
- **THEN** command logs error and returns empty suggestions

#### Scenario: Parse LLM JSON response
- **WHEN** LLM returns text response
- **THEN** command extracts JSON from response (handling markdown code fences)

#### Scenario: Validate response format
- **WHEN** LLM response is parsed
- **THEN** command validates presence of required fields (skills, toolQueries arrays)

#### Scenario: Empty results produce empty JSON
- **WHEN** no relevant skills or tools are found
- **THEN** command returns empty JSON object `{}` (hook will skip injection)

#### Scenario: Use provided gateway URL
- **WHEN** command needs to search for MCP tools
- **THEN** command uses the gateway URL provided via `--gateway-url` flag

#### Scenario: Search gateway for each tool query
- **WHEN** LLM suggests tool search queries
- **THEN** command calls gateway search endpoint for each query to find matching tools

#### Scenario: Handle missing gateway URL
- **WHEN** gateway URL is not provided via flag
- **THEN** command skips tool search and only suggests skills (if any)

#### Scenario: Handle tool search failures
- **WHEN** gateway search fails for a query
- **THEN** command continues with other queries and skill suggestions

#### Scenario: Format skill suggestions
- **WHEN** relevant skills are identified
- **THEN** command formats each as instruction to use Skill(skill-name) tool

#### Scenario: Format tool suggestions
- **WHEN** relevant MCP tools are found
- **THEN** command formats as instruction to use toolscript skill with specific tool names

#### Scenario: Combined context formatting
- **WHEN** both skills and tools are relevant
- **THEN** command formats unified context mentioning both, instructing use of toolscript skill for MCP tools

#### Scenario: Context tone
- **WHEN** command formats context
- **THEN** message is informative and helpful, not aggressive or demanding

#### Scenario: Wrap context in hook JSON
- **WHEN** formatted context is ready
- **THEN** command wraps it in hook response format: `{"hookSpecificOutput":{"additionalContext":"formatted text here"}}`

#### Scenario: Return empty JSON when no context
- **WHEN** no skills or tools are relevant
- **THEN** command returns `{}` to signal hook should not inject anything
