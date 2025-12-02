# claude-plugin Spec Delta

## MODIFIED Requirements

### Requirement: SessionStart Hook
The plugin SHALL provide a hook that starts gateway in background on session start and persists gateway URL for hook access.

#### Scenario: Write gateway URL to file
- **WHEN** gateway starts successfully
- **THEN** hook writes gateway URL to `${TMPDIR}toolscript-gateway-${SESSION_ID}.url` for hooks without env var access

#### Scenario: Gateway URL file format
- **WHEN** URL file is written
- **THEN** file contains only the URL (e.g., `http://localhost:12345`) with no additional text

#### Scenario: Gateway URL file permissions
- **WHEN** URL file is created
- **THEN** file is created with read permissions for the current user

## REMOVED Requirements

### Requirement: SessionStart Context Injection
The SessionStart hook SHALL NOT inject static context encouraging toolscript usage.

#### Scenario: No hardcoded context in SessionStart
- **WHEN** SessionStart hook executes
- **THEN** hook does not output `additionalContext` in JSON response

## ADDED Requirements

### Requirement: UserPromptSubmit Hook
The plugin SHALL provide a hook that intelligently suggests relevant skills and tools based on user prompts.

#### Scenario: Hook registration
- **WHEN** plugin is loaded
- **THEN** UserPromptSubmit hook is registered in `plugins/toolscript/hooks/hooks.json`

#### Scenario: Hook script location
- **WHEN** UserPromptSubmit hook executes
- **THEN** script is located at `plugins/toolscript/scripts/user-prompt-submit.sh`

#### Scenario: Receive user prompt
- **WHEN** UserPromptSubmit hook executes
- **THEN** hook receives JSON input with fields: `prompt`, `cwd`, `session_id`

#### Scenario: Read gateway URL from file
- **WHEN** hook executes
- **THEN** hook reads gateway URL from `${TMPDIR}toolscript-gateway-${SESSION_ID}.url`

#### Scenario: Exit when no gateway URL
- **WHEN** gateway URL file doesn't exist or is empty
- **THEN** hook exits successfully without calling CLI command or injecting context

#### Scenario: Call CLI suggestion command with gateway URL
- **WHEN** hook has user prompt and gateway URL exists
- **THEN** hook calls `toolscript context claude-usage-suggestion --prompt "$PROMPT" --gateway-url "$GATEWAY_URL"`

#### Scenario: Receive hook JSON response
- **WHEN** CLI command returns
- **THEN** hook receives valid JSON (either with additionalContext or empty object)

#### Scenario: Output CLI response directly
- **WHEN** CLI command returns JSON
- **THEN** hook outputs the JSON response as-is (pass-through)

#### Scenario: CLI command error
- **WHEN** `toolscript context claude-usage-suggestion` fails
- **THEN** hook logs error and exits successfully without context injection

#### Scenario: Hook runs after SessionStart
- **WHEN** UserPromptSubmit hook executes
- **THEN** SessionStart hook has already created gateway URL file (enforced by lifecycle)

#### Scenario: Multiple prompts in session
- **WHEN** user submits multiple prompts
- **THEN** hook evaluates each prompt independently and may suggest different skills/tools
