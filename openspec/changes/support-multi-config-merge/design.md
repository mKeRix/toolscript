# Design: Multi-Config Merge Implementation

## Architecture

### Current State
```typescript
// src/config/loader.ts
export async function loadConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
): Promise<ToolscriptConfig | null> {
  // Reads single file, returns null if not found
}

// DEFAULT_CONFIG_PATH = "./.toolscript.json"
```

### Proposed State
```typescript
// src/config/loader.ts
export async function loadConfig(
  configPaths: string | string[] = DEFAULT_CONFIG_PATHS,
): Promise<ToolscriptConfig | null> {
  // Reads multiple files, merges them, returns merged config or null
}

// DEFAULT_CONFIG_PATHS = "~/.toolscript.json,.toolscript.json"
```

## Implementation Strategy

### 1. Path Parsing and Expansion
**Goal**: Convert comma-separated string or array to absolute paths with tilde expansion

```typescript
/**
 * Parse config paths from string or array.
 * Handles comma-separated strings and tilde expansion.
 */
function parseConfigPaths(input: string | string[]): string[] {
  const paths = typeof input === "string" ? input.split(",").map(p => p.trim()) : input;
  return paths.map(expandTildePath);
}

/**
 * Expand ~ to user home directory.
 */
function expandTildePath(path: string): string {
  if (path.startsWith("~/")) {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!homeDir) {
      throw new Error("Cannot expand ~: HOME or USERPROFILE not set");
    }
    return homeDir + path.slice(1);
  }
  return path;
}
```

**Platform Considerations**:
- **Unix/Linux/macOS**: Use `$HOME` environment variable
- **Windows**: Use `%USERPROFILE%` environment variable
- **Fallback**: Deno provides both via `Deno.env.get()`

### 2. Config Loading
**Goal**: Load each config file, skip missing files, collect valid configs

```typescript
/**
 * Load a single config file.
 * Returns null if file doesn't exist, throws on parse/validation errors.
 */
async function loadSingleConfig(path: string): Promise<ToolscriptConfig | null> {
  try {
    const content = await Deno.readTextFile(path);
    const rawConfig = JSON.parse(content);
    const configWithEnv = substituteEnvVarsInObject(rawConfig);
    const validated = toolscriptConfigSchema.parse(configWithEnv);
    return validated;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null; // File doesn't exist - this is OK
    }
    // Re-throw parse errors, validation errors, etc.
    throw new Error(`Failed to load config from ${path}: ${error.message}`);
  }
}

/**
 * Load multiple config files and collect non-null results.
 */
async function loadConfigs(paths: string[]): Promise<ToolscriptConfig[]> {
  const configs: ToolscriptConfig[] = [];

  for (const path of paths) {
    const config = await loadSingleConfig(path);
    if (config !== null) {
      configs.push(config);
    }
  }

  return configs;
}
```

**Error Handling**:
- **File not found**: Skip silently (return null), continue to next config
- **JSON parse error**: Throw with clear message including file path and line number
- **Schema validation error**: Throw with clear message including which field failed validation

### 3. Config Merging
**Goal**: Merge configs left-to-right, with later servers overriding earlier ones

```typescript
/**
 * Merge multiple configs.
 * Later configs override earlier ones at the server level.
 */
function mergeConfigs(configs: ToolscriptConfig[]): ToolscriptConfig {
  const merged: ToolscriptConfig = { mcpServers: {} };

  for (const config of configs) {
    // Merge mcpServers object
    // Later server definitions completely replace earlier ones (no deep merge)
    Object.assign(merged.mcpServers, config.mcpServers);
  }

  return merged;
}
```

**Merge Semantics**:
- Use JavaScript's `Object.assign()` for shallow merge
- Each server name is a key in the `mcpServers` object
- If server name appears in multiple configs, the last one wins
- No deep merging of server properties (entire server object is replaced)

**Why Shallow Merge?**
- **Simplicity**: Easy to understand and predict
- **Type safety**: Different server types (stdio vs http) have different required fields
- **Tool filtering**: `includeTools`/`excludeTools` shouldn't combine across configs
- **Environment vars**: Avoid complex merge logic for `env` objects

### 4. Main Entry Point
**Goal**: Refactor `loadConfig()` to accept multiple paths and orchestrate loading/merging

```typescript
/**
 * Load and merge configuration from multiple files.
 *
 * @param configPaths - Single path, comma-separated paths, or array of paths
 * @returns Merged configuration, or null if no configs exist
 */
export async function loadConfig(
  configPaths: string | string[] = DEFAULT_CONFIG_PATHS,
): Promise<ToolscriptConfig | null> {
  const paths = parseConfigPaths(configPaths);
  const configs = await loadConfigs(paths);

  if (configs.length === 0) {
    // No config files found - return null (consistent with current behavior)
    return null;
  }

  return mergeConfigs(configs);
}
```

### 5. CLI Integration
**Goal**: Update CLI commands to pass config paths correctly

**Changes Required**:
1. `src/cli/commands/gateway.ts`: Update `--config` option to accept comma-separated string
2. `src/cli/commands/auth.ts`: Update `--config` option to accept comma-separated string
3. Update default value from `DEFAULT_CONFIG_PATH` to `DEFAULT_CONFIG_PATHS`

**Example**:
```typescript
// Before
.option("-c, --config <path:string>", "Path to config file", {
  default: DEFAULT_CONFIG_PATH,
})

// After
.option("-c, --config <paths:string>", "Path(s) to config file(s) (comma-separated)", {
  default: DEFAULT_CONFIG_PATHS,
})
```

## Data Flow

```
User Input: --config ~/.toolscript.json,.toolscript.json
                    ↓
          parseConfigPaths()
                    ↓
    ["/Users/me/.toolscript.json", "/Users/me/project/toolscript.json"]
                    ↓
          loadConfigs() (parallel/sequential)
                    ↓
    [config1: {...}, config2: {...}]
                    ↓
          mergeConfigs()
                    ↓
    merged: { mcpServers: { github: {...}, postgres: {...} } }
```

## Testing Strategy

### Unit Tests (`src/config/loader.test.ts`)
1. **Path parsing**:
   - Test comma-separated string parsing
   - Test array input passthrough
   - Test tilde expansion on Unix and Windows
   - Test whitespace trimming

2. **Single file loading**:
   - Test successful load
   - Test missing file returns null
   - Test JSON parse error throws
   - Test validation error throws

3. **Multi-file loading**:
   - Test loading multiple valid configs
   - Test skipping missing files
   - Test error on invalid JSON in second file

4. **Config merging**:
   - Test server-level override (later wins)
   - Test merging non-overlapping servers
   - Test empty config list returns null

5. **Environment variable substitution**:
   - Test env vars work in merged configs
   - Test env vars from different files

### Integration Tests (`tests/integration/config.test.ts`)
1. Test full config loading with temp files
2. Test default config paths behavior
3. Test explicit comma-separated paths

### E2E Tests (`tests/e2e/cli.test.ts`)
1. Test gateway starts with merged config
2. Test auth command works with merged config
3. Test `--config` flag accepts comma-separated paths

## Edge Cases

### Case 1: All config files missing
**Behavior**: Return `null` (consistent with current behavior)
**Rationale**: Gateway can start with zero servers configured

### Case 2: First config exists, second doesn't
**Behavior**: Load and return first config only
**Rationale**: Missing files are skipped, not errors

### Case 3: Same server in both configs with different types
**Behavior**: Second config's server definition completely replaces first
**Rationale**: Server-level replacement, no validation that types match

### Case 4: Empty mcpServers in second config
**Behavior**: No servers from first config are removed (empty object merges cleanly)
**Rationale**: `Object.assign({github: {...}}, {})` leaves `github` intact

### Case 5: User specifies single path (backwards compat)
**Behavior**: Load only that config, no merging
**Rationale**: `parseConfigPaths("./my.json")` returns `["./my.json"]`, works as before

### Case 6: Relative paths in config list
**Behavior**: Resolve relative to current working directory
**Rationale**: Deno's `readTextFile()` resolves relative paths relative to CWD

### Case 7: Tilde in middle of path (`/home/~user/config.json`)
**Behavior**: Only expand tilde at start of path (`~/...`)
**Rationale**: Tilde expansion is only meaningful for `~/` pattern

## Security Considerations

### Path Traversal
**Risk**: User provides malicious path like `../../../../etc/passwd`
**Mitigation**: Not needed - we only read config files, not execute them. Schema validation ensures contents are safe.

### Environment Variable Injection
**Risk**: Merged config could expose environment variables unexpectedly
**Mitigation**: Env var substitution happens *after* merge, treating merged config as single source

### Secret Leakage
**Risk**: User commits project config with hardcoded secrets
**Mitigation**: Documentation emphasizes using `${ENV_VAR}` syntax. Not a technical issue with merging.

## Performance Considerations

### Sequential vs Parallel Loading
**Decision**: Load configs **sequentially** (not parallel)
**Rationale**:
- Maintains merge order clarity (left-to-right)
- Typically only 2 files, performance difference negligible
- Simpler error handling and debugging
- Config loading happens once at startup

**Benchmark**: Loading 2 config files sequentially should add <10ms to startup time

### Caching
**Decision**: No caching of config files
**Rationale**:
- Config loading happens once per command invocation
- Gateway restarts when config changes (no live reload)
- Caching adds complexity with no real benefit

## Migration Guide

### For Users with Existing `.toolscript.json`
**No action required**. Your project config will continue to work. Optionally create `~/.toolscript.json` for user-level defaults.

### For Users Who Want User-Level Config
1. Create `~/.toolscript.json` with your personal MCP servers
2. Keep project-specific config in `.toolscript.json`
3. Project config will override user config for any servers with the same name

### For Users Who Want Custom Config Paths
Use `--config` flag with comma-separated paths:
```bash
toolscript gateway start --config ~/configs/mcp.json,./project.json
```

## Alternative Designs Considered

### Deep Merge of Server Objects
**Rejected**: Too complex, unclear semantics for type changes, tool filter merging

### XDG Base Directory (`~/.config/toolscript/config.json`)
**Rejected**: Less discoverable, more complex for single-file config

### Environment Variable for User Config Path
**Rejected**: CLI flag + default covers most use cases, env var adds complexity

### YAML Instead of JSON
**Rejected**: Out of scope for this change, JSON is already established

### Config Directory with Multiple Files
**Rejected**: Overengineering for current needs, can revisit if needed

## Open Questions

### Q: Should we validate that merged config is sensible?
**A**: No. Schema validation ensures each file is valid; merge is purely additive at server level.

### Q: Should we log which configs were loaded?
**A**: Yes, at debug level. Could add `--verbose` flag to show config sources.

### Q: Should we support glob patterns in config paths?
**A**: No, out of scope. Users can specify explicit paths.

### Q: Should we support config extends/inheritance?
**A**: No, out of scope. Merge behavior is sufficient.

### Q: What if user has both `.toolscript.json` and `toolscript.json` (without dot)?
**A**: The default uses `.toolscript.json` (with leading dot). If user has `toolscript.json` (no dot), they need to explicitly specify it with `--config`.
