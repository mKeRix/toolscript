# configuration Specification Delta

## MODIFIED Requirements

### Requirement: Multiple Configuration Files with Merge
The system SHALL support loading and merging multiple configuration files specified as comma-separated paths.

#### Scenario: Multiple config paths via CLI
- **WHEN** user specifies `--config ~/.toolscript.json,.toolscript.json`
- **THEN** system loads both files and merges them left-to-right

#### Scenario: Default loads user and project config
- **WHEN** no --config flag is provided
- **THEN** system loads from `~/.toolscript.json,.toolscript.json` (new default)

#### Scenario: Tilde expansion in paths
- **WHEN** config path starts with `~/`
- **THEN** system expands tilde to user's home directory

#### Scenario: Later config overrides earlier
- **WHEN** server name appears in multiple configs
- **THEN** server definition from rightmost config completely replaces earlier definitions

#### Scenario: Server-level replacement not deep merge
- **WHEN** merging configs with same server name
- **THEN** entire server object is replaced (no merging of individual properties like env or args)

#### Scenario: Skip missing config files
- **WHEN** config path list includes non-existent files
- **THEN** system skips missing files without error and merges remaining configs

#### Scenario: All config files missing
- **WHEN** all config paths in list point to non-existent files
- **THEN** system returns null config (allows gateway launch with zero servers)

#### Scenario: Single config path backwards compatible
- **WHEN** user specifies single path like `--config ./my.json`
- **THEN** system loads only that file without merging (backwards compatible)

#### Scenario: Whitespace trimmed from paths
- **WHEN** config string includes spaces like `~/.toolscript.json, ./toolscript.json`
- **THEN** system trims whitespace from each path before loading

#### Scenario: Environment variable substitution in merged config
- **WHEN** multiple configs contain `${VAR}` references
- **THEN** environment variable substitution occurs after merge using final merged config

#### Scenario: Non-overlapping servers merged
- **WHEN** config files define different server names
- **THEN** merged config includes all servers from all files

#### Scenario: Empty mcpServers in config
- **WHEN** one config has empty `mcpServers: {}` object
- **THEN** merge continues normally (empty object merges cleanly with others)

### Requirement: Configuration Path Parsing
The system SHALL parse configuration paths from comma-separated strings or arrays.

#### Scenario: Parse comma-separated string
- **WHEN** config input is `"path1,path2,path3"`
- **THEN** system splits into array `["path1", "path2", "path3"]`

#### Scenario: Accept array input
- **WHEN** config input is `["path1", "path2"]`
- **THEN** system uses array directly without parsing

#### Scenario: Expand tilde on Unix
- **WHEN** path starts with `~/` on Unix/Linux/macOS
- **THEN** system expands using `$HOME` environment variable

#### Scenario: Expand tilde on Windows
- **WHEN** path starts with `~/` on Windows
- **THEN** system expands using `%USERPROFILE%` environment variable

#### Scenario: Tilde only at path start
- **WHEN** tilde appears mid-path like `/home/~user/config.json`
- **THEN** system does not expand tilde (only `~/...` pattern expanded)

#### Scenario: Error if HOME not set
- **WHEN** path contains `~/` and `$HOME`/`%USERPROFILE%` not set
- **THEN** system throws error indicating cannot expand tilde

### Requirement: Configuration Loading with Error Handling
The system SHALL load each config file individually with appropriate error handling.

#### Scenario: JSON parse error includes file path
- **WHEN** config file has JSON syntax error
- **THEN** system reports error including file path, line number, and column

#### Scenario: Validation error includes file path
- **WHEN** config file fails schema validation
- **THEN** system reports error including file path and which field failed

#### Scenario: Missing file skipped silently
- **WHEN** config file does not exist
- **THEN** system logs at debug level and continues with remaining files

#### Scenario: Second config file error stops merge
- **WHEN** second config file has parse or validation error
- **THEN** system throws error immediately (does not return partial merge)

## REMOVED Requirements

### Requirement: Single Configuration File
~~The system SHALL use a single configuration file location.~~

**Note**: This requirement is replaced by "Multiple Configuration Files with Merge" requirement above.

#### Scenario: Default config location
~~- **WHEN** no --config flag is provided~~
~~- **THEN** system loads configuration from `./.toolscript.json`~~

**Note**: New default is `~/.toolscript.json,.toolscript.json`

#### Scenario: Explicit config path
~~- **WHEN** user specifies --config flag~~
~~- **THEN** system loads configuration from specified path~~

**Note**: Now supports comma-separated paths

#### Scenario: No multi-level merging
~~- **WHEN** configuration is loaded~~
~~- **THEN** system uses only the single specified config file, no merging from multiple locations~~

**Note**: Multi-level merging is now the primary feature

## Notes on Unchanged Requirements

The following existing requirements remain unchanged and work with merged configs:

- **Configuration File Format**: JSON format still required for all config files
- **MCP Server Configuration**: Server schema unchanged, merging happens at object level
- **Configuration Validation**: Each config file validated individually before merge
- **Environment Variable Support**: Works the same in merged configs
- **Secret Management**: Still use `${VAR}` syntax, no change
- **Optional Configuration File**: Gateway still launches if all configs missing
