# Design: Intelligent Context Injection

## Overview

This document captures the architectural decisions and design rationale for replacing static context injection with an intelligent, LLM-powered system that dynamically selects relevant skills and tools based on user prompts.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Session                       │
│                                                               │
│  User Prompt                                                  │
│      │                                                        │
│      ▼                                                        │
│  ┌──────────────────────────────────────┐                   │
│  │  UserPromptSubmit Hook (Bash)        │                   │
│  │  - Reads user prompt from JSON       │                   │
│  │  - Calls toolscript claude-suggest-context│              │
│  │  - Parses JSON response              │                   │
│  │  - Injects contextual suggestions    │                   │
│  └──────────┬───────────────────────────┘                   │
│             │                                                 │
└─────────────┼─────────────────────────────────────────────┬──┘
              │                                               │
              ▼                                               │
  ┌───────────────────────────────────────┐                  │
  │  toolscript context claude-usage-     │                  │
  │  suggestion (New CLI Command)         │                  │
  │  - Scans global/project/plugin skills │                  │
  │  - Calls Claude SDK for selection     │                  │
  │  - Receives gateway URL via flag      │                  │
  │  - Searches MCP tools on gateway      │                  │
  │  - Formats context text               │                  │
  │  - Returns hook JSON response         │                  │
  └──────────┬────────────────────────────┘                  │
             │                                                 │
             ▼                                                 │
  ┌────────────────────────────────┐                         │
  │  Claude Agent SDK              │                         │
  │  - Model: "haiku" (user config)│                         │
  │  - Config sources: user, project, local                 │
  │  - Tools: none                  │                         │
  │  - Single turn execution        │                         │
  └────────────────────────────────┘                         │
```

### Data Flow

#### 1. Session Start (Existing + Enhanced)

```
SessionStart Hook:
1. Start gateway on random port → background process
2. Save PID to ${TMPDIR}toolscript-gateway-${SESSION_ID}.pid
3. Save URL to ${TMPDIR}toolscript-gateway-${SESSION_ID}.url  ← NEW
4. Export TOOLSCRIPT_GATEWAY_URL to CLAUDE_ENV_FILE
5. (Remove static context injection)  ← MODIFIED
```

#### 2. User Prompt Submit (New)

```
UserPromptSubmit Hook:
1. Receive JSON: { prompt: "...", cwd: "...", session_id: "..." }
2. Read gateway URL from ${TMPDIR}toolscript-gateway-${SESSION_ID}.url
3. If gateway URL missing/empty: Exit successfully (no toolscript without gateway)
4. Call: toolscript context claude-usage-suggestion --prompt "$PROMPT" --gateway-url "$GATEWAY_URL"
5. Receive hook JSON response from CLI
6. Output CLI response as-is (pass-through)
```

#### 3. CLI Command Execution

```
toolscript context claude-usage-suggestion:
1. Scan skills from all sources:
   - Global: ~/.claude/skills/*/SKILL.md
   - Project: .claude/skills/*/SKILL.md
   - Plugins: Load installed_plugins.json and scan {installPath}/skills/*/SKILL.md
   - Extract YAML frontmatter description from each
   - Build unified skill list: [{name, description, source}, ...]
2. Create Claude Agent SDK query:
   - Model: "haiku" (uses user's configured model)
   - Prompt: Template with user prompt + skill list
   - Options:
     * settingSources: ["user", "project", "local"]
     * systemPrompt: (custom, not Claude Code's)
     * allowedTools: []
     * Single iteration (for await one response)
3. Parse LLM response (JSON with skills and toolQueries arrays)
4. If --gateway-url provided:
   - For each toolQuery:
     - Search gateway for matching tools
     - Collect tool names and descriptions
5. Format context text:
   - Skills: Instruct to use Skill(name) for each
   - Tools: Instruct to use toolscript skill with tool names
   - Combined: Unified message if both present
6. Wrap in hook JSON:
   - If context: `{"hookSpecificOutput":{"additionalContext":"formatted text"}}`
   - If no context: `{}`
7. Output JSON to stdout
8. Exit
```

## Key Design Decisions

### Decision 1: UserPromptSubmit vs SessionStart

**Choice**: Use UserPromptSubmit hook instead of enhancing SessionStart

**Rationale**:
- SessionStart runs before any user prompt, so it can't be context-aware
- UserPromptSubmit receives the actual user prompt as input
- Allows adaptation to changing user needs within a session
- Can skip injection for irrelevant prompts (e.g., "hello", "thanks")

**Trade-offs**:
- Adds latency to every user prompt (~200-500ms)
- Increases API costs (small: ~$0.0005 per prompt)
- More complex error handling required

### Decision 2: CLI Command vs Inline Bash Logic

**Choice**: Build `claude-suggest-context` as proper CLI command, not inline Bash

**Rationale**:
- TypeScript provides better error handling and type safety
- Agent SDK is a TypeScript library (better integration)
- CLI command is testable independently
- Can reuse existing config loading, path utilities
- Follows project conventions (commands in src/cli/commands/)

**Trade-offs**:
- More code to write and maintain
- Slightly slower startup than pure Bash
- Additional compilation during development

### Decision 3: Claude Agent SDK vs Direct API Calls

**Choice**: Use Claude Agent SDK wrapper, not direct fetch() calls

**Rationale**:
- User explicitly requested "seamless SDK experience"
- SDK handles authentication, retry logic, error handling
- Benefit from SDK improvements over time
- Demonstrates SDK best practices for the project
- Supports all 3 config sources natively

**Trade-offs**:
- Adds dependency (@anthropic-ai/claude-agent-sdk)
- Slightly larger bundle size
- Must follow SDK version updates

### Decision 4: Gateway URL File Storage

**Choice**: Store gateway URL in temp file, parallel to PID file

**Rationale**:
- Hooks don't have access to environment variables set by other hooks
- Consistent with existing PID file pattern
- Atomic write, simple read
- Easy cleanup on session end

**File Location**: `${TMPDIR}toolscript-gateway-${SESSION_ID}.url`

**Trade-offs**:
- Another file to manage
- Potential race condition if hook runs before SessionStart completes (mitigated by SessionStart running first)

### Decision 5: Model Selection (Haiku Category)

**Choice**: Use "haiku" model category, letting users configure their preferred Haiku model

**Rationale**:
- Task is simple classification/selection (Haiku is sufficient)
- Cost: $0.80/$4 per MTok (vs Sonnet $3/$15)
- Speed: Faster response times (~200ms vs ~500ms)
- Frequent usage pattern (every user prompt)
- Users can choose their preferred Haiku version via Claude Agent SDK config

**Estimated Usage**:
- Input: ~400 tokens (prompt + skill list)
- Output: ~20 tokens (JSON response)
- Cost: ~$0.0004 per prompt
- For 1000 prompts: ~$0.40

**Trade-offs**:
- Slightly less accurate than Sonnet (acceptable for this task)

### Decision 6: No Tools for Agent

**Choice**: Agent runs with no tools available (allowedTools: [])

**Rationale**:
- Task is pure text generation (select from list)
- No file reading, no bash execution needed
- Faster execution (no tool consideration overhead)
- More secure (can't execute unintended commands)

**Trade-offs**:
- None - tools not needed for this task

### Decision 7: Single Turn Execution

**Choice**: Agent executes single turn, no interactive loop

**Rationale**:
- Task has clear input/output contract (prompt → JSON)
- No clarification questions needed
- Faster execution
- Simpler error handling

**Implementation**:
```typescript
const response = query({ prompt, options });
for await (const message of response) {
  if (message.type === 'assistant') {
    return JSON.parse(message.content);
  }
}
```

**Trade-offs**:
- Can't handle ambiguous prompts (acceptable - fallback is to suggest nothing)

### Decision 8: Skill Discovery Method

**Choice**: Scan skills from three locations: global, project, and plugins

**Rationale**:
- `~/.claude/skills`: Global skills available to all sessions
- `.claude/skills`: Project-specific skills
- Plugin skills: installed_plugins.json provides plugin locations
- All use consistent SKILL.md format (YAML frontmatter)
- Progressive disclosure pattern requires descriptions < 300 chars
- Matches Claude Code's skill discovery pattern

**Alternative Considered**: Only scan plugins (rejected - misses global/project skills)

**Trade-offs**:
- More directories to scan (small performance impact)
- Must handle missing directories gracefully
- Must deduplicate if same skill name appears in multiple locations

### Decision 9: Fallback Behavior

**Choice**: Gracefully degrade when API unavailable, delegate auth to SDK

**Scenarios**:
1. **SDK Auth Error**: Agent SDK handles authentication, return empty suggestions on failure
2. **API Error**: Return empty suggestions
3. **Timeout**: Abort after 5s, return empty suggestions
4. **Malformed Response**: Return empty suggestions

**Rationale**:
- Session should never crash due to context injection
- Silent failure is acceptable (Claude still gets prompt)
- Claude Agent SDK handles all authentication concerns

### Decision 10: CLI Command Owns Full Flow

**Choice**: CLI command does all work including tool search and formatting

**Rationale**:
- Single source of truth for context generation
- Hook becomes simple pass-through (no logic)
- CLI command testable end-to-end in isolation
- Easier to debug - all logic in one place
- CLI returns ready-to-inject text (no JSON parsing in bash)

**Flow**:
```bash
# In UserPromptSubmit hook
GATEWAY_URL=$(cat "${TMPDIR}toolscript-gateway-${SESSION_ID}.url" 2>/dev/null || echo "")

# Exit early if no gateway (toolscript requires gateway)
if [ -z "$GATEWAY_URL" ]; then
  exit 0
fi

# Call CLI and output its JSON response directly
toolscript context claude-usage-suggestion --prompt "$PROMPT" --gateway-url "$GATEWAY_URL"
```

## Implementation Phases

### Phase 1: Foundation (MVP)

- New CLI command `claude-suggest-context`
- Basic Claude Agent SDK integration
- Skill scanning from installed_plugins.json
- Simple prompt template
- JSON output format

**Success Criteria**: Command returns valid JSON with skill names

### Phase 2: Hook Integration

- UserPromptSubmit hook in hooks.json
- Bash script that calls CLI command
- Gateway URL file persistence
- Basic context injection

**Success Criteria**: Hook executes and injects skill suggestions

### Phase 3: Tool Search Integration

- Hook searches gateway for tools
- Combines skills + tools in context
- Handles empty results gracefully

**Success Criteria**: Relevant tools appear in context when applicable

### Phase 4: Polish & Optimization

- Error handling and fallbacks
- Logging and debugging
- Performance optimization
- Documentation and examples

**Success Criteria**: All error paths tested, docs complete

## Testing Strategy

### Unit Tests

- `claude-suggest-context.test.ts`: CLI command logic
  - Skill scanning from plugin directories
  - YAML frontmatter parsing
  - JSON output formatting
  - Error handling

### Integration Tests

- `agent-integration.test.ts`: Agent SDK wrapper
  - Model selection
  - Config source loading
  - Single-turn execution
  - Response parsing

### E2E Tests

- `hook-e2e.test.ts`: Full hook flow
  - SessionStart sets up gateway + URL file
  - UserPromptSubmit calls CLI and injects context
  - Verify context only appears when relevant
  - Verify fallback behavior

### Manual Testing

- Install plugins with various skills
- Test prompts:
  - Relevant: "search for code examples"
  - Irrelevant: "hello"
  - Ambiguous: "help me"
- Verify API key scenarios (present, missing, invalid)

## Security Considerations

### API Key Management

- **Delegation**: Claude Agent SDK handles all authentication
- **Storage**: Managed by Agent SDK config sources (user, project, local)
- **Transmission**: HTTPS to api.anthropic.com (handled by SDK)
- **Error Messages**: SDK provides appropriate error messages

### Input Validation

- **User Prompts**: Passed to LLM (already trusted)
- **Plugin Paths**: Validate against installed_plugins.json
- **SKILL.md Files**: Parse carefully, handle malformed YAML

### Resource Limits

- **API Costs**: ~$0.0005 per prompt (acceptable)
- **Timeout**: 5 second limit on LLM calls
- **File Size**: SKILL.md files should be small (<5KB)

### Prompt Injection

- **Risk**: User could craft prompts to manipulate skill selection
- **Impact**: Low (worst case: irrelevant skills suggested)
- **Mitigation**: Structured output format (JSON), validate response

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Hook Latency | < 500ms (p95) | Time from hook start to context injection |
| LLM Call | < 300ms (p95) | Claude API response time |
| Tool Search | < 100ms per query | toolscript search execution |
| Skill Scanning | < 50ms | Read all SKILL.md files |
| Total Cost | < $0.001 per prompt | API costs (input + output tokens) |

## Open Architecture Questions

1. **Caching**: Should we cache LLM responses for identical prompts?
   - **Consideration**: Same prompt might have different context (files changed)
   - **Proposal**: Short-lived cache (5 min TTL) with prompt hash as key

2. **Rate Limiting**: Should we limit API calls?
   - **Consideration**: Rapid-fire prompts could rack up costs
   - **Proposal**: Max 1 call per 5 seconds, queue subsequent prompts

3. **Plugin Updates**: How to handle plugin installations during session?
   - **Current**: Skill list read once per prompt
   - **Alternative**: Cache skill list, invalidate on plugin changes (complex)

4. **Multi-Language Support**: Should descriptions support localization?
   - **Current**: English only
   - **Future**: Read locale from Claude Code settings, match descriptions

5. **Tool Ranking**: How to prioritize tools when many match?
   - **Current**: Return first N from search
   - **Alternative**: Let LLM rank tools by relevance

## Dependencies

### New Dependencies

- `@anthropic-ai/claude-agent-sdk` (TypeScript)
  - Version: Latest stable
  - Used for Claude API integration
  - ~100KB bundle size

### Environment Variables

- Authentication managed by Claude Agent SDK configuration
- Existing: `TOOLSCRIPT_GATEWAY_URL` (still needed for tool search)

### File System

- Read: `~/.claude/plugins/installed_plugins.json`
- Read: `{plugin_path}/skills/*/SKILL.md`
- Write: `${TMPDIR}toolscript-gateway-${SESSION_ID}.url`
