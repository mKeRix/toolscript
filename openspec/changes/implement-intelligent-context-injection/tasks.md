# Implementation Tasks

## Overview

This document outlines the implementation tasks for the intelligent context injection system. Tasks are ordered to deliver incremental, testable value and highlight dependencies.

## Phase 1: Foundation & Dependencies

### Task 1.1: Add Agent SDK Dependency
**Goal**: Install and configure Claude Agent SDK package

- Add `@anthropic-ai/claude-agent-sdk` to deno.json imports
- Run `deno cache` to download dependencies
- Verify types are available in IDE

**Deliverable**: SDK available for import
**Test**: Import SDK in test file, verify no errors

---

### Task 1.2: Create Skill Discovery Utility
**Goal**: Implement skill scanning from all sources (global, project, plugins)

- Create `src/utils/skill-discovery.ts`
- Implement `scanGlobalSkills()` to scan `~/.claude/skills/*/SKILL.md`
- Implement `scanProjectSkills()` to scan `.claude/skills/*/SKILL.md`
- Implement `loadInstalledPlugins()` to read `~/.claude/plugins/installed_plugins.json`
- Implement `scanPluginSkills(pluginPath)` to find plugin SKILL.md files
- Implement `parseSkillDescription(content)` to extract YAML frontmatter
- Implement `mergeSkills()` to combine all sources and deduplicate
- Handle missing directories and malformed YAML gracefully

**Deliverable**: Utility that returns `Array<{name: string, description: string, source: string}>`
**Test**: Unit tests with mock skill directories and SKILL.md files

---

### Task 1.3: Create Agent SDK Wrapper
**Goal**: Build TypeScript wrapper for Claude Agent SDK with configuration for suggestion tasks

- Create `src/agent/suggestion.ts`
- Implement `suggestContext(userPrompt, skills)` function
- Configure Agent SDK query:
  - Model: "haiku" (uses user's configured model)
  - settingSources: ["user", "project", "local"]
  - allowedTools: []
  - Custom systemPrompt for skill/tool classification
- Implement timeout protection (5s with AbortSignal)
- Implement response parsing and validation
- Handle all error cases (network errors, malformed response)
- Delegate authentication to Agent SDK

**Deliverable**: Function that returns `Promise<{skills: string[], toolQueries: string[]}>`
**Test**: Unit tests with mocked Agent SDK responses

---

## Phase 2: CLI Command Implementation

### Task 2.1: Create CLI Command File
**Goal**: Scaffold the `context claude-usage-suggestion` command

- Create `src/cli/commands/context.ts` for the context command group
- Create `src/cli/commands/context/claude-usage-suggestion.ts` for the subcommand
- Define command using @cliffy/command
- Add `--prompt` and `--gateway-url` options
- Wire up to main CLI in `src/cli/main.ts`

**Deliverable**: Command appears in `toolscript context --help`
**Test**: Run `toolscript context claude-usage-suggestion --help`

---

### Task 2.2: Implement Command Logic
**Goal**: Full end-to-end flow in CLI command

- Import skill discovery utility
- Import agent wrapper
- Implement command action:
  1. Scan skills from all sources (global, project, plugins)
  2. Call agent wrapper with user prompt and skills
  3. Parse LLM response (skills and toolQueries)
  4. If --gateway-url provided: Search gateway for each tool query
  5. Format context text (skills + tools)
  6. Wrap in hook JSON response
  7. Output JSON to stdout
- Handle errors and return empty JSON `{}` on failures

**Deliverable**: Working CLI command that outputs hook JSON response
**Test**: Manual test with sample prompts, verify JSON output

**Dependencies**: Tasks 1.2, 1.3

---

### Task 2.3: Add Gateway Search Integration
**Goal**: Search gateway for MCP tools when URL provided

- Import gateway search functionality (or use existing toolscript search)
- Check if --gateway-url was provided
- For each toolQuery from LLM, search gateway
- Collect tool names and descriptions
- Handle search failures gracefully (skip failed queries)

**Deliverable**: CLI finds relevant MCP tools when gateway URL provided
**Test**: Test with and without --gateway-url, verify behavior

**Dependencies**: Task 2.2

---

### Task 2.4: Implement Context Formatting
**Goal**: Format context text and wrap in hook JSON

- Format skill suggestions: Instruct to use Skill(name)
- Format tool suggestions: Instruct to use toolscript skill with tool names
- Combine skills + tools into unified message
- Use informative, helpful tone (not aggressive)
- Wrap in hook JSON: `{"hookSpecificOutput":{"additionalContext":"..."}}`
- Return empty JSON `{}` when nothing relevant

**Deliverable**: Well-formatted hook JSON responses
**Test**: Verify JSON structure and context quality

**Dependencies**: Task 2.3

---

### Task 2.5: Add Fallback Behavior
**Goal**: Handle all error cases gracefully

- Return empty JSON `{}` on SDK auth errors
- Return empty JSON `{}` on timeout/network errors
- Return empty JSON `{}` on malformed LLM responses
- Return empty JSON `{}` on gateway search failures

**Deliverable**: Command never crashes, always returns valid JSON
**Test**: Test all error scenarios, verify valid JSON

**Dependencies**: Task 2.4

---

## Phase 3: Gateway URL Persistence

### Task 3.1: Modify SessionStart Hook Script
**Goal**: Save gateway URL to temp file for hook access

- Edit `plugins/toolscript/scripts/session-start.sh`
- After starting gateway, write URL to `${TMPDIR}toolscript-gateway-${CLAUDE_SESSION_ID}.url`
- Ensure file contains only URL (no extra text)
- Add logging of URL file path

**Deliverable**: URL file created on session start
**Test**: Start session, verify file exists and contains URL

---

### Task 3.2: Remove Static Context Injection
**Goal**: Remove hardcoded "MUST USE TOOLSCRIPT FIRST" message from SessionStart

- Edit `plugins/toolscript/scripts/session-start.sh`
- Remove the `additionalContext` field from JSON output
- Keep other functionality intact (gateway start, PID file, env var)

**Deliverable**: SessionStart no longer injects aggressive context
**Test**: Start session, verify no static context appears

**Dependencies**: Task 3.1

---

## Phase 4: UserPromptSubmit Hook Implementation

### Task 4.1: Create UserPromptSubmit Hook Script
**Goal**: Scaffold the hook script that will be called on each user prompt

- Create `plugins/toolscript/scripts/user-prompt-submit.sh`
- Make executable (`chmod +x`)
- Implement JSON input reading (user prompt, cwd, session_id)
- Add basic logging to temp file

**Deliverable**: Hook script that can be called manually
**Test**: Echo JSON to script, verify logging works

---

### Task 4.2: Integrate CLI Command Call
**Goal**: Hook reads gateway URL and calls CLI command

- In hook script, read gateway URL from ${TMPDIR}toolscript-gateway-${SESSION_ID}.url
- If URL missing/empty: Exit successfully without calling CLI
- If URL exists: call `toolscript context claude-usage-suggestion --prompt "$PROMPT" --gateway-url "$GATEWAY_URL"`
- Output CLI response directly (no processing needed)
- Handle command failures gracefully (log and exit without output)

**Deliverable**: Hook exits early without gateway, passes through CLI JSON when gateway exists
**Test**: Test with and without gateway URL file

**Dependencies**: Task 2.5, 3.1, 4.1

---

### Task 4.3: Test Hook Behavior
**Goal**: Verify hook correctly handles all cases

- Test with gateway URL present and relevant prompt (should output CLI JSON)
- Test with gateway URL missing (should exit without output)
- Test with CLI returning empty JSON (should pass through `{}`)
- Test with CLI errors (should exit without output)

**Deliverable**: Hook works correctly in all scenarios
**Test**: Run hook with various inputs, verify correct behavior

**Dependencies**: Task 4.2

---

### Task 4.4: Register UserPromptSubmit Hook
**Goal**: Add hook to hooks.json so Claude Code calls it

- Edit `plugins/toolscript/hooks/hooks.json`
- Add UserPromptSubmit hook entry with matcher "prompt_input_submit"
- Point to `${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt-submit.sh`

**Deliverable**: Hook is registered and called by Claude Code
**Test**: Submit prompt in Claude Code session, verify hook executes

**Dependencies**: Task 4.3

---

## Phase 5: Testing & Validation

### Task 5.1: Unit Tests for Agent Wrapper
**Goal**: Comprehensive unit tests for agent integration

- Test timeout protection
- Test response parsing (valid JSON, malformed, empty)
- Test error handling (network, API errors, rate limits)
- Mock Agent SDK responses

**Deliverable**: >90% coverage for agent wrapper
**Test**: Run `deno test src/agent/suggestion.test.ts`

**Dependencies**: Task 1.3

---

### Task 5.2: Unit Tests for Skill Discovery
**Goal**: Test skill scanning and parsing

- Test loading installed_plugins.json (valid, missing, malformed)
- Test scanning SKILL.md files (valid, missing, malformed YAML)
- Test description extraction
- Mock filesystem operations

**Deliverable**: >90% coverage for skill discovery
**Test**: Run `deno test src/utils/skill-discovery.test.ts`

**Dependencies**: Task 1.2

---

### Task 5.3: Integration Test for CLI Command
**Goal**: Test full CLI command flow including tool search

- Test with mocked Agent SDK (no real API calls)
- Test with mocked gateway search
- Test with sample skills list
- Test various user prompts (relevant, irrelevant, ambiguous)
- Test error cases (API failure, timeout, gateway unavailable)
- Verify hook JSON output format

**Deliverable**: CLI command tested end-to-end
**Test**: Run `deno test src/cli/commands/claude-suggest-context.test.ts`

**Dependencies**: Task 2.5, 5.1, 5.2

---

### Task 5.4: E2E Test for Hook Flow
**Goal**: Test complete flow from prompt to context injection

- Start toolscript gateway in test environment
- Trigger UserPromptSubmit hook with test JSON
- Verify CLI command is called with correct arguments
- Verify context is injected when relevant
- Verify no injection when irrelevant
- Test error scenarios (CLI failure, gateway down)

**Deliverable**: Full hook flow validated
**Test**: Run `deno test tests/e2e/claude-hook-integration.test.ts`

**Dependencies**: Task 4.4

---

### Task 5.5: Manual Testing with Real Plugins
**Goal**: Test with actual installed Claude Code plugins

- Install multiple plugins with different skills
- Test prompts related to those skills
- Verify correct skills are suggested
- Verify MCP tools are found when relevant
- Test performance (latency should be <500ms p95)

**Deliverable**: Verified behavior in real environment
**Test**: Manual checklist completed

**Dependencies**: Task 4.6

---

## Phase 6: Documentation & Polish

### Task 6.1: Update README
**Goal**: Document new intelligent context injection feature

- Add section explaining UserPromptSubmit hook
- Document that authentication is handled by Claude Agent SDK
- Explain cost implications (~$0.0004 per prompt)
- Add troubleshooting section

**Deliverable**: Updated README.md
**Test**: Review for clarity and completeness

---

### Task 6.2: Update Architecture Docs
**Goal**: Document new components in architecture.md

- Add diagram showing UserPromptSubmit flow
- Document agent wrapper module
- Document skill discovery utility
- Update data flow section

**Deliverable**: Updated docs/architecture.md
**Test**: Review for accuracy

---

### Task 6.3: Add CLAUDE.md Guidance
**Goal**: Help LLMs understand the new system

- Document intelligent context injection in CLAUDE.md
- Explain when suggestions appear vs don't appear
- Note fallback behavior and SDK authentication

**Deliverable**: Updated CLAUDE.md
**Test**: Review for LLM usability

---

### Task 6.4: Error Handling Audit
**Goal**: Ensure all error paths are handled gracefully

- Review all error cases in agent wrapper
- Review all error cases in CLI command
- Review all error cases in hook script
- Ensure no case causes session crash
- Ensure all errors are logged appropriately

**Deliverable**: Robust error handling
**Test**: Test all identified error scenarios

---

## Phase 7: Optimization (Future Work)

### Task 7.1: Response Caching
**Goal**: Cache LLM responses to reduce costs for repeated prompts

- Design cache key (hash of prompt + skills)
- Implement simple file-based cache
- Add TTL (5 minutes)
- Add cache hit/miss metrics

**Deliverable**: Reduced API costs for repeated prompts
**Test**: Verify cache works, measure cost reduction

**Note**: This is marked as future work, not required for initial release

---

### Task 7.2: Rate Limiting
**Goal**: Prevent excessive API calls in rapid-fire scenarios

- Track API calls per session
- Implement max 1 call per 5 seconds
- Queue subsequent prompts
- Add bypass flag for testing

**Deliverable**: Cost protection for rapid prompts
**Test**: Verify rate limiting works, doesn't impact normal usage

**Note**: This is marked as future work, not required for initial release

---

## Summary

**Total Tasks**: 24 (19 required + 5 validation/docs + 2 future work)

**Critical Path**:
1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → (3.1) → 4.1 → 4.2 → 4.3 → 4.4
Note: 3.1 needed before 4.2 for gateway URL lookup in hook

**Parallelizable Work**:
- Task 3.1 (gateway URL) can happen early
- Task 5.x (tests) can be written alongside implementation
- Task 6.x (docs) can be drafted early

**Estimated Effort**: ~2-3 days for full implementation + testing + docs (simplified from original estimate)
