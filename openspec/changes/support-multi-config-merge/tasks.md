# Tasks: Support Multiple Configuration Files with Merge

## Phase 1: Core Implementation

### 1.1 Implement path parsing and expansion utilities
- [ ] Add `parseConfigPaths()` function to parse comma-separated strings and arrays
- [ ] Add `expandTildePath()` function to expand `~/` to user home directory
- [ ] Handle Unix (`$HOME`) and Windows (`%USERPROFILE%`) environments
- [ ] Add error handling for missing HOME/USERPROFILE
- [ ] Add unit tests for path parsing (comma separation, array passthrough, whitespace trimming)
- [ ] Add unit tests for tilde expansion on different platforms

**Verification**: Tests pass for all path parsing edge cases

### 1.2 Refactor loadConfig to support multiple files
- [ ] Rename `DEFAULT_CONFIG_PATH` constant to `DEFAULT_CONFIG_PATHS`
- [ ] Update value from `./.toolscript.json` to `~/.toolscript.json,.toolscript.json`
- [ ] Add `loadSingleConfig()` helper function (returns null if file not found)
- [ ] Add `loadConfigs()` function to load multiple files sequentially
- [ ] Update error messages to include file path for parse/validation errors
- [ ] Add unit tests for single file loading (success, missing, parse error, validation error)
- [ ] Add unit tests for multi-file loading (skip missing files, handle errors)

**Verification**: All config loading tests pass

### 1.3 Implement config merging logic
- [ ] Add `mergeConfigs()` function using `Object.assign()` for server-level merge
- [ ] Ensure later configs override earlier ones by server name
- [ ] Handle empty `mcpServers` objects gracefully
- [ ] Add unit tests for non-overlapping servers
- [ ] Add unit tests for overlapping servers (later wins)
- [ ] Add unit tests for empty mcpServers in one config
- [ ] Verify environment variable substitution works after merge

**Verification**: Merge tests demonstrate correct override behavior

### 1.4 Update main loadConfig entry point
- [ ] Change signature to accept `string | string[]` for configPaths
- [ ] Call `parseConfigPaths()` to normalize input
- [ ] Call `loadConfigs()` to load all files
- [ ] Call `mergeConfigs()` if configs exist, return null otherwise
- [ ] Update JSDoc comments to reflect new behavior
- [ ] Add integration test with temp files simulating user + project configs

**Verification**: Integration test loads and merges two config files correctly

## Phase 2: CLI Integration

### 2.1 Update gateway command
- [ ] Change `--config` option description to mention comma-separated paths
- [ ] Update default value to `DEFAULT_CONFIG_PATHS`
- [ ] Test gateway start with default config paths
- [ ] Test gateway start with explicit comma-separated paths
- [ ] Add E2E test for gateway with merged config

**Verification**: Gateway starts successfully with merged config

### 2.2 Update auth command
- [ ] Change `--config` option description to mention comma-separated paths
- [ ] Update default value to `DEFAULT_CONFIG_PATHS`
- [ ] Test auth command with merged config
- [ ] Add E2E test for auth with user + project configs

**Verification**: Auth command works with merged config

## Phase 3: Documentation

### 3.1 Update CLI documentation
- [ ] Update `docs/cli.md` to describe multi-config support
- [ ] Add examples of `--config` with comma-separated paths
- [ ] Document default behavior (`~/.toolscript.json,.toolscript.json`)
- [ ] Explain merge semantics (server-level override, left-to-right)
- [ ] Add example user + project config scenario

**Verification**: Documentation is clear and accurate

### 3.2 Update README
- [ ] Update README.md configuration section
- [ ] Add example of user-level config in `~/.toolscript.json`
- [ ] Add example of project-level config in `.toolscript.json`
- [ ] Show merged result example
- [ ] Document tilde expansion support

**Verification**: README provides clear guidance on multi-config usage

### 3.3 Update migration guide
- [ ] Add migration note for users upgrading from single config
- [ ] Explain backwards compatibility (existing `.toolscript.json` still works)
- [ ] Document how to opt-out of user config (use `--config .toolscript.json`)
- [ ] Provide examples of common migration scenarios

**Verification**: Migration guide addresses user concerns

## Phase 4: Validation and Polish

### 4.1 Review and update tests
- [ ] Ensure all existing tests still pass
- [ ] Review test coverage for new code paths
- [ ] Add missing edge case tests if needed
- [ ] Verify error messages are clear and actionable
- [ ] Test on macOS, Linux, and Windows (if possible)

**Verification**: Test suite is comprehensive and passes

### 4.2 Code quality checks
- [ ] Run `deno fmt` to format all changes
- [ ] Run `deno lint` and fix any issues
- [ ] Run `deno check` to verify type correctness
- [ ] Review code for simplicity and clarity
- [ ] Add code comments for complex logic

**Verification**: Code passes all quality checks

### 4.3 Performance validation
- [ ] Benchmark config loading with 1 vs 2 files
- [ ] Verify startup time impact is <10ms
- [ ] Confirm gateway startup time remains <2s
- [ ] Profile memory usage (should be negligible)

**Verification**: Performance meets constraints from openspec/project.md

### 4.4 Security review
- [ ] Verify path traversal is not a concern
- [ ] Confirm env var substitution happens after merge
- [ ] Review error messages for potential info leakage
- [ ] Document secret management best practices in docs

**Verification**: No security concerns identified

## Phase 5: Final Validation

### 5.1 OpenSpec validation
- [ ] Run `openspec validate support-multi-config-merge --strict`
- [ ] Fix any validation errors
- [ ] Verify all scenarios in spec are implemented
- [ ] Confirm tasks align with spec requirements

**Verification**: OpenSpec validation passes

### 5.2 End-to-end testing
- [ ] Create user config in `~/.toolscript.json` with test servers
- [ ] Create project config in `.toolscript.json` with overrides
- [ ] Run `toolscript gateway start` and verify merge
- [ ] Run `toolscript list-servers` and verify servers from both configs
- [ ] Run `toolscript auth` and verify server list is merged
- [ ] Test with missing user config (only project config exists)
- [ ] Test with missing project config (only user config exists)

**Verification**: Real-world usage scenarios work as expected

### 5.3 Final checklist
- [ ] All tests pass (`deno test`)
- [ ] Code is formatted (`deno fmt --check`)
- [ ] No lint errors (`deno lint`)
- [ ] Types are correct (`deno check src/**/*.ts`)
- [ ] Documentation is up to date
- [ ] OpenSpec validation passes
- [ ] E2E scenarios work
- [ ] Ready for review

**Verification**: Change is complete and ready to merge

## Dependencies

- **Phase 2** depends on **Phase 1** (CLI integration needs core implementation)
- **Phase 3** can be done in parallel with **Phase 1-2**
- **Phase 4** depends on **Phase 1-2** (validation requires implementation)
- **Phase 5** depends on all previous phases

## Parallel Work Opportunities

- **Tasks 1.1, 1.2, 1.3** can be done in parallel (separate functions)
- **Tasks 2.1, 2.2** can be done in parallel (different commands)
- **Tasks 3.1, 3.2, 3.3** can be done in parallel (different docs)
- **Tasks 4.1, 4.2, 4.3, 4.4** can be done in parallel (independent checks)

## Estimated Effort

- **Phase 1**: 3-4 hours (core implementation + tests)
- **Phase 2**: 1-2 hours (CLI updates + tests)
- **Phase 3**: 1-2 hours (documentation)
- **Phase 4**: 1-2 hours (validation and polish)
- **Phase 5**: 1 hour (final validation)

**Total**: ~8-11 hours

## Notes

- Keep changes minimal and focused on the spec requirements
- Preserve backwards compatibility (single config path still works)
- Follow existing code patterns in `src/config/loader.ts`
- Use clear error messages with file paths for debugging
- Test on multiple platforms if possible (macOS, Linux, Windows)
