# Implement Intelligent Context Injection

**Change ID**: `implement-intelligent-context-injection`
**Status**: Proposed
**Created**: 2025-12-01

## Summary

Replace the static context injection in SessionStart hook with an intelligent UserPromptSubmit hook that uses the Claude Agent SDK to dynamically select relevant skills and MCP tools based on the user's actual prompt.

## Motivation

### Current Problem

The current SessionStart hook injects a hardcoded, aggressive message that tells Claude to ALWAYS use toolscript first for every task. This approach:

1. **Lacks Context Awareness**: Prompts like "hello" or "what's the weather" trigger toolscript suggestions even when irrelevant
2. **Poor User Experience**: Aggressive all-caps messaging feels pushy and unnatural
3. **Inefficient**: Claude wastes time considering toolscript when it's not applicable
4. **Not Scalable**: As more skills are installed from various plugins, static injection becomes unmaintainable

### Why Now

- Reference implementation exists (svelte-claude-skills) demonstrating LLM-based skill evaluation
- Claude Agent SDK provides clean integration path with configuration flexibility
- Current architecture already supports hooks and has gateway infrastructure
- User feedback indicates desire for more intelligent, context-aware behavior

## What Changes

This proposal introduces an intelligent context injection system:

1. **New CLI Command**: `toolscript context claude-usage-suggestion` that uses Claude Agent SDK to:
   - Analyze user prompts with configured Haiku model
   - Select relevant skills from global, project, and plugin skill directories
   - Generate MCP tool search queries
   - Search gateway for matching MCP tools (if gateway URL provided)
   - Format context text and wrap in hook JSON response
   - Return `{"hookSpecificOutput":{"additionalContext":"..."}}` or `{}`

2. **UserPromptSubmit Hook**: New hook that:
   - Reads gateway URL from session temp file
   - Exits early if no gateway URL (no toolscript without gateway)
   - Calls the CLI command with user prompt and gateway URL
   - Outputs the CLI's JSON response directly (pass-through)

3. **Gateway URL Persistence**: Store gateway URL in temp file (like PID) since hooks don't have access to environment variables

4. **Agent SDK Integration**: Seamless Claude Agent SDK usage with:
   - All 3 config sources (user, project, local)
   - No Claude Code system prompt (custom prompt only)
   - No tools available to agent (pure text generation)
   - Single-turn execution (no interactive loop)

**Breaking changes**: None - this is additive functionality

## Impact

### Affected Specs

- **Modified capability**: `cli-interface` - New command for intelligent context suggestion
- **Modified capability**: `claude-plugin` - UserPromptSubmit hook, gateway URL persistence
- **New capability**: `claude-agent-integration` - Claude Agent SDK wrapper and configuration

### Dependencies

- **External**: `@anthropic-ai/claude-agent-sdk` TypeScript package
- **Configuration**: Managed by Claude Agent SDK (supports all 3 config sources)
- **Runtime**: Adds ~400 tokens input + ~20 tokens output per user prompt (~$0.0004 per prompt with Haiku)

### User Impact

**Positive**:
- More relevant, context-aware skill and tool suggestions
- Less noise and aggressive messaging
- Automatic discovery of tools from newly installed MCP servers
- Works across all Claude Code plugin skills, not just toolscript

**Considerations**:
- Authentication managed by Claude Agent SDK configuration
- Graceful fallback to empty suggestions when API unavailable
- Small latency increase (<500ms) per prompt for LLM evaluation

## Alternatives Considered

### 1. Static Keyword Matching

**Approach**: Pattern match user prompts against keyword lists

**Pros**:
- No API costs
- Instant response
- No external dependencies

**Cons**:
- Brittle and requires constant maintenance
- Poor handling of natural language variations
- Can't understand context or intent

**Verdict**: Rejected - doesn't solve the core problem of context awareness

### 2. Direct API Calls (No Agent SDK)

**Approach**: Use fetch() to call Claude API directly, similar to svelte-claude-skills reference

**Pros**:
- Simpler implementation
- Fewer dependencies
- More direct control

**Cons**:
- Doesn't leverage Agent SDK configuration system
- No benefit from SDK improvements over time
- Misses opportunity to demonstrate SDK best practices
- User specifically requested Agent SDK usage

**Verdict**: Rejected - user explicitly wants Agent SDK integration for seamless experience

### 3. SessionStart with Complex Logic

**Approach**: Keep SessionStart but add intelligence within that hook

**Pros**:
- Single hook to maintain
- Runs only once per session

**Cons**:
- Can't adapt to changing user needs within session
- Wrong lifecycle event (no user prompt context)
- Doesn't solve the core timing problem

**Verdict**: Rejected - UserPromptSubmit is the correct hook for prompt-based decisions

## Open Questions

1. **Rate Limiting**: Should we implement rate limiting to prevent excessive API calls (e.g., max 1 call per 5 seconds)?
2. **Caching**: Should we cache results for identical/similar prompts?
3. **Tool Search Depth**: How many tools should we fetch from gateway per search query?
4. **Fallback Behavior**: What should happen when API call fails or times out?
5. **Cost Control**: Should there be a budget limit or opt-out mechanism?

## Success Criteria

1. **Relevance**: Context injection only appears when skills/tools are actually relevant
2. **Performance**: LLM evaluation completes within 500ms for 95% of prompts
3. **Accuracy**: Agent correctly identifies relevant skills at least 90% of the time
4. **Cost**: Average cost per prompt stays below $0.001
5. **Reliability**: Graceful fallback when API unavailable, no session crashes
