# Proposal: Support Multiple Configuration Files with Merge Behavior

## Change ID
`support-multi-config-merge`

## Status
Proposed

## Overview
Enable toolscript to accept multiple configuration file paths via the `--config` flag, merging them in order with later values overriding earlier ones. Update the default configuration path from `./.toolscript.json` to `~/.toolscript.json,.toolscript.json` to support both user-level and project-level configuration.

## Problem Statement
Currently, toolscript only supports a single configuration file location specified via `--config` or defaulting to `./.toolscript.json`. This creates friction when users want to:

1. **Share common MCP server configurations** across multiple projects (e.g., personal API keys, frequently-used servers)
2. **Override user-level defaults** with project-specific settings (e.g., different server versions, project-specific tools)
3. **Maintain separation of concerns** between user preferences and project requirements

Other development tools (Git, npm, VS Code) solve this with hierarchical configuration that merges user-level and project-level settings. Toolscript should follow this familiar pattern.

## Proposed Solution
1. **Accept comma-separated config paths** in the `--config` flag (e.g., `--config ~/.toolscript.json,.toolscript.json`)
2. **Merge configurations left-to-right** with later configs overriding earlier ones
3. **Change default from `./.toolscript.json` to `~/.toolscript.json,.toolscript.json`** to enable user + project configuration out of the box
4. **Support tilde expansion** (`~`) in config paths for portability

### Merge Behavior
- **Server-level merging**: If the same server name appears in multiple configs, the later config's server definition completely replaces the earlier one (no deep merge of server properties)
- **mcpServers object merge**: The `mcpServers` objects from each config are merged, with later configs overriding earlier entries by server name
- **Missing files tolerated**: If a config file in the list doesn't exist, skip it and continue (consistent with current behavior of allowing missing config)

### Example
**~/.toolscript.json** (user-level):
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/docs"]
    }
  }
}
```

**.toolscript.json** (project-level):
```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./project-data"],
      "excludeTools": ["write_file"]
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${PROJECT_DATABASE_URL}"
      }
    }
  }
}
```

**Merged result**:
```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./project-data"],
      "excludeTools": ["write_file"]
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${PROJECT_DATABASE_URL}"
      }
    }
  }
}
```

Note: The `filesystem` server from the project config completely replaced the user-level one (no deep merge of individual properties).

## Rationale

### Why This Approach?
1. **Familiar pattern**: Matches Git's `.gitconfig` + `.git/config`, npm's `.npmrc`, VS Code's settings
2. **Backwards compatible**: Single config path still works; users can opt-in to multi-config
3. **Explicit ordering**: Comma-separated list makes merge order clear
4. **Simple merge semantics**: Server-level replacement is easier to reason about than deep merging
5. **Secure defaults**: User config can't accidentally expose project-specific secrets

### Why Server-Level Replacement Instead of Deep Merge?
- **Predictability**: Easier to understand which config "wins" (always the rightmost one)
- **Type safety**: Avoids complex merge logic for different server types (stdio vs http vs sse)
- **Tool filtering clarity**: `includeTools`/`excludeTools` in project config shouldn't merge with user config
- **Simplicity**: Less code, fewer edge cases, easier to debug

### Why Not XDG Base Directory?
While `$XDG_CONFIG_HOME/toolscript/config.json` is the "correct" Unix pattern, we chose `~/.toolscript.json` because:
- **Simplicity**: Single file is easier for users than a directory structure
- **Discoverability**: `~/.toolscript.json` is easier to find than `~/.config/toolscript/config.json`
- **Consistency**: Other Deno tools (like `deno install`) use `~/.deno/` pattern
- **Future expansion**: If we add more config files later, we can create `~/.toolscript/` directory

### Migration Path
Users with existing `.toolscript.json` files will continue to work unchanged (the `./` prefix is implicit). The new default just adds `~/.toolscript.json` as a base layer if it exists.

## Scope
This change affects:
- **Configuration loading** (`src/config/loader.ts`)
- **CLI interface** (`src/cli/commands/gateway.ts`, `src/cli/commands/auth.ts`)
- **Configuration spec** (requirements for merge behavior)
- **Documentation** (CLI docs, README examples)

This change does NOT affect:
- Server configuration schema (no new fields)
- Gateway runtime behavior
- Toolscript execution
- Type generation

## Dependencies
No external dependencies required. Uses existing Deno APIs for path expansion and file reading.

## Risks and Mitigations

### Risk: Confusing merge behavior
**Mitigation**: Clear documentation with examples, `--verbose` logging to show which configs were loaded

### Risk: User accidentally shares secrets in project config
**Mitigation**: Documentation emphasizes using `${ENV_VAR}` syntax, not hardcoded secrets

### Risk: Performance impact from reading multiple files
**Mitigation**: Config loading is already async and happens once at startup; impact is negligible (<10ms)

### Risk: Breaking changes for users with `~/.toolscript.json` already
**Mitigation**: Unlikely (current default is `.toolscript.json` in current directory), but if encountered, users can use `--config .toolscript.json` to override

## Success Criteria
1. Users can specify `--config ~/.toolscript.json,.toolscript.json` and see merged configuration
2. Default behavior loads `~/.toolscript.json` then `.toolscript.json` (if they exist)
3. Later configs override earlier ones at the server level
4. Missing config files are skipped without error (unless all configs missing and gateway needs servers)
5. `~` expands to user's home directory on all platforms
6. All existing tests pass
7. New tests validate merge behavior

## Related Specs
- `configuration`: Requires modifications to support multiple config paths and merge logic

## Related Changes
None - this is a standalone enhancement.
