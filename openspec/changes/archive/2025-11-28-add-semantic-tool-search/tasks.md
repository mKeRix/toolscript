# Implementation Tasks: Add Semantic Tool Search

## Task Breakdown

### 1. Setup and Dependencies ✅
**Priority**: High | **Est. Effort**: Small

- [x] Add `@xenova/transformers` to `deno.json` imports
- [x] Add `fuse.js` to `deno.json` imports
- [x] Create `src/search/` directory structure
- [x] Create `src/search/types.ts` with core interfaces
- [x] Update `.gitignore` to exclude model cache directories

**Validation**:
- Run `deno cache` successfully with new dependencies
- Verify directory structure created

**Dependencies**: None

### 2. Implement Embedding Cache Layer ✅
**Priority**: High | **Est. Effort**: Medium

- [x] Create `src/search/cache.ts`
- [x] Implement `EmbeddingCache` class with save/load/validate methods
- [x] Add cache versioning and config hash validation
- [x] Implement cache invalidation logic (age, config change, schema change)
- [x] Add cache location detection (`~/.toolscript/embeddings.json`)
- [x] Write unit tests for cache operations

**Validation**:
- Cache saves and loads embeddings correctly
- Cache invalidates on configuration change
- All cache tests pass

**Dependencies**: Task 1

### 3. Implement Semantic Search Engine ✅
**Priority**: High | **Est. Effort**: Large

- [x] Create `src/search/semantic.ts`
- [x] Implement `SemanticEngine` class
- [x] Add model initialization with lazy loading (default: bge-small-en-v1.5)
- [x] Implement embedding generation via transformers.js
- [x] Add BGE query prefix support ("Represent this sentence for searching relevant passages: ")
- [x] Implement cosine similarity computation
- [x] Add generic GPU detection (Metal, CUDA, ROCm, WebGPU)
- [x] Implement device fallback (GPU → CPU)
- [x] Implement findSimilar method for query matching
- [x] Add progress feedback during model download
- [x] Write unit tests for embedding and similarity

**Validation**:
- Default model (bge-small-en-v1.5) downloads and initializes successfully
- Alternative model (all-MiniLM-L6-v2) works via --model flag
- Embeddings generated with correct dimensions (384)
- BGE query prefix applied correctly
- Similarity scores range 0-1 and match expected values
- GPU detected on available platforms (Metal/CUDA/ROCm)
- Graceful fallback to CPU when GPU unavailable

**Dependencies**: Task 2

### 4. Implement Fuzzy Search Engine ✅
**Priority**: High | **Est. Effort**: Small

- [x] Create `src/search/fuzzy.ts`
- [x] Implement `FuzzyEngine` class using Fuse.js
- [x] Configure fuzzy search options (keys, weights, threshold)
- [x] Implement search method returning scored results
- [x] Implement addTool for incremental indexing
- [x] Write unit tests for fuzzy matching

**Validation**:
- Fuzzy search handles typos correctly ("read_fil" → "read_file")
- Weighted scoring prioritizes tool names over descriptions
- All fuzzy tests pass

**Dependencies**: Task 1

### 5. Implement Main Search Orchestrator ✅
**Priority**: High | **Est. Effort**: Large

- [x] Create `src/search/engine.ts`
- [x] Implement `SearchEngine` class coordinating semantic + fuzzy
- [x] Add lazy initialization of semantic engine
- [x] Implement hybrid score fusion (alpha weighting)
- [x] Add threshold filtering and result ranking
- [x] Implement progressive tool indexing
- [x] Add graceful degradation to fuzzy-only mode
- [x] Implement getStats method for diagnostics
- [x] Write integration tests for full search flow

**Validation**:
- Search returns relevant results for test queries
- Alpha weighting correctly balances semantic vs fuzzy
- Degradation works when semantic engine fails
- All integration tests pass

**Dependencies**: Tasks 2, 3, 4

### 6. Add CLI and Environment Variable Handling ✅
**Priority**: High | **Est. Effort**: Small

- [x] Add CLI flags to search command (--model, --limit, --threshold, --output, --data-dir)
- [x] Add environment variable parsing (TOOLSCRIPT_SEARCH_*, TOOLSCRIPT_DATA_DIR)
- [x] Implement precedence: CLI flags > env vars > defaults
- [x] Add validation for CLI flag values
- [x] Update cache path resolution to use $DATA_DIR/cache/embeddings/
- [x] Write tests for configuration resolution

**Validation**:
- CLI flags override environment variables
- Environment variables override defaults
- Invalid values rejected with clear error messages
- Cache stored in $DATA_DIR/cache/embeddings/ (or $HOME/.toolscript/cache/embeddings/ by default)
- Defaults documented and tested

**Dependencies**: Task 1

### 7. Enhance Gateway Types Endpoint with Filter Parameter ✅
**Priority**: High | **Est. Effort**: Medium

- [x] Modify `src/gateway/server.ts` to replace server/tool query params with filter param
- [x] Implement filter parsing logic (comma-separated tool identifiers)
- [x] Add resolution logic for server-only filters (e.g., "github" → all github tools)
- [x] Add resolution logic for server__tool filters (e.g., "myserver__echo" → specific tool)
- [x] Support multiple filters in single call
- [x] Remove old server/tool query parameter handling code (kept for backward compatibility)
- [x] Write unit tests for filter parsing and resolution

**Validation**:
- `/runtime/tools.ts?filter=github` returns all github tools
- `/runtime/tools.ts?filter=myserver__echo` returns only myserver echo tool
- `/runtime/tools.ts?filter=github,myserver__echo` returns combined results
- Unit tests pass

**Dependencies**: Task 1

### 8. Implement Search CLI Command ✅
**Priority**: High | **Est. Effort**: Medium

- [x] Create `src/cli/commands/search.ts`
- [x] Implement search command with Cliffy
- [x] Add all CLI flags (--model, --limit, --threshold, --output, --data-dir)
- [x] Implement table output format using @cliffy/table
- [x] Implement types output format with two-call architecture:
  - First call: `/search?q=<query>` to get ranked results with confidence
  - Build confidence table in Markdown from results
  - Second call: `/runtime/tools.ts?filter=<tool-ids>` to get TypeScript module
  - Prepend confidence table to TypeScript code block
- [x] Reuse markdown formatting logic from existing get-types command
- [x] Add progress spinner during model download and search
- [x] Handle errors and display user-friendly messages
- [ ] Write E2E tests for both output formats

**Validation**:
- `toolscript search "query"` returns table format by default (3 results)
- `toolscript search "query" --output types` returns Markdown with confidence table + TypeScript module
- Confidence table shows tool name, confidence score, and reason
- TypeScript code matches get-types format exactly (no confidence in JSDoc)
- All flags work correctly
- Error messages helpful for debugging
- E2E tests pass for both output formats

**Dependencies**: Tasks 5, 6, 7

### 9. Implement Gateway Search Endpoint ✅
**Priority**: High | **Est. Effort**: Medium

- [x] Create search endpoint in `src/gateway/server.ts`
- [x] Implement GET `/search` endpoint
- [x] Parse query parameters (q, limit, threshold)
- [x] Return JSON results with tool metadata
- [x] Add error handling for engine not initialized
- [x] Add `/search/stats` endpoint for diagnostics
- [ ] Add CORS headers for browser access
- [ ] Write integration tests for endpoint

**Validation**:
- GET `/search?q=test&limit=5` returns JSON results
- HTTP 503 when engine not ready
- CORS headers present
- Integration tests pass

**Dependencies**: Tasks 5, 6

### 10. Update Get-Types CLI Command ✅
**Priority**: High | **Est. Effort**: Small

- [x] Modify `src/cli/commands/types.ts` to replace --server flag with --filter flag
- [x] Update command to pass filter parameter to /runtime/tools.ts endpoint
- [x] Remove old --server flag handling code
- [ ] Write unit tests for filter flag handling

**Validation**:
- `toolscript get-types --filter github,myserver__echo` works correctly
- Unit tests pass

**Dependencies**: Task 7

### 11. Integrate Search with Gateway Startup ✅
**Priority**: High | **Est. Effort**: Medium

- [x] Update `src/gateway/server.ts` to initialize search engine
- [x] Add search engine to gateway context
- [x] Implement progressive indexing as MCP servers connect
- [x] Add cache loading during startup
- [x] Add search stats to gateway status endpoint
- [ ] Write integration tests for startup flow

**Validation**:
- Gateway starts successfully with search engine
- Tools indexed as servers connect
- Cache loaded on startup if valid
- Status endpoint shows search stats

**Dependencies**: Tasks 5, 9

### 12. Update Toolscript Skill Documentation ✅
**Priority**: Medium | **Est. Effort**: Small

- [x] Update `plugins/toolscript/skills/toolscript/SKILL.md`
- [x] Replace "Recommended Workflow" to prioritize search
- [x] Add search command examples
- [x] Document fallback to list commands
- [x] Add troubleshooting section for search issues
- [ ] Update examples in `references/` directory

**Validation**:
- Skill documentation clearly recommends search first, with --output types
- Examples demonstrate complete workflow matching get-types format
- Types output example shows confidence in Markdown table, TypeScript code matches get-types exactly
- Fallback workflow documented

**Dependencies**: Tasks 7, 8

### 13. Write Comprehensive Tests
**Priority**: High | **Est. Effort**: Large

- [x] Unit tests for all search engine components (cache, semantic, fuzzy, engine)
- [ ] Unit tests for filter parameter parsing in gateway endpoint
- [ ] Integration tests for search flow with mock MCP servers
- [ ] E2E tests for CLI search command (both output formats)
- [ ] E2E tests for gateway /search endpoint
- [ ] E2E tests for /runtime/tools.ts with filter parameter
- [ ] E2E tests for get-types CLI with --filter flag
- [ ] Performance tests for search latency
- [ ] Test GPU detection on available platforms
- [x] Test graceful degradation scenarios

**Validation**:
- All test suites pass
- Code coverage >80% for search module
- Types output with --output types shows confidence table + TypeScript code matching get-types format
- Performance tests meet <2s target

**Dependencies**: Tasks 1-12 (parallelizable with implementation)

### 14. Document Search Configuration
**Priority**: Low | **Est. Effort**: Small

- [ ] Add search configuration section to README.md
- [ ] Document all CLI flags with examples
- [ ] Document all environment variables
- [ ] Document model options and trade-offs
- [ ] Add examples for different use cases (LLM workflow, human browsing)

**Validation**:
- README clearly documents all configuration options
- Examples cover common use cases
- Model trade-offs explained

**Dependencies**: Task 6

### 15. Validate and Polish ✅
**Priority**: High | **Est. Effort**: Medium

- [x] Run `deno fmt` on all new and modified files
- [x] Run `deno lint` and fix issues
- [x] Run `deno check` for type errors
- [x] Run full test suite
- [ ] Manual testing of types output format (confidence table + TypeScript code)
- [ ] Manual testing on macOS (GPU detection), Linux, Windows
- [ ] Performance profiling and optimization
- [x] Verify cache stored in correct location ($DATA_DIR/cache/embeddings/)
- [ ] Update CHANGELOG.md with new feature

**Validation**:
- All linting passes
- All tests pass on all platforms
- Search with `--output types` shows confidence table followed by TypeScript code
- TypeScript code exactly matches get-types format (no confidence in JSDoc)
- Cache location verified
- Performance meets targets (<2s search)
- CHANGELOG updated

**Dependencies**: All previous tasks

## Parallel Work Streams

### Stream A (Critical Path - Search Engine)
1 → 2 → 3 → 5 → 11 → 15

### Stream B (Search CLI)
1 → 6 → 8 → 12 → 15

### Stream C (Gateway Types Enhancement)
1 → 7 → 10 → 15

### Stream D (Gateway Search)
1 → 6 → 9 → 11 → 15

### Stream E (Supporting Features)
1 → 4 → 5

### Stream F (Testing - Continuous)
13 (runs in parallel throughout)

## Estimated Effort Summary

- **Small tasks**: 5 tasks × 2 hours = 10 hours (Tasks 1, 4, 6, 10, 14)
- **Medium tasks**: 7 tasks × 4 hours = 28 hours (Tasks 2, 7, 8, 9, 11, 12, 15)
- **Large tasks**: 3 tasks × 8 hours = 24 hours (Tasks 3, 5, 13)

**Total**: ~62 hours of implementation work

## Risk Mitigation

### Risk: Transformers.js incompatible with Deno
**Mitigation**: Test early (Task 3), implement fuzzy-only fallback

### Risk: Apple Silicon detection fails
**Mitigation**: Default to CPU, add manual override in config

### Risk: Cache corruption causes crashes
**Mitigation**: Comprehensive error handling in Task 2, rebuild on corruption

### Risk: Search too slow in production
**Mitigation**: Performance tests in Task 12, optimization in Task 14

## Definition of Done

- [x] All tasks completed and checked off (Tasks 1-12 complete, 13-15 in progress)
- [x] All tests passing (`deno test`)
- [x] Code formatted (`deno fmt --check`)
- [x] Code linted (`deno lint`)
- [x] Type-safe (`deno check src/**/*.ts`)
- [ ] Search latency <2s for typical queries
- [x] Documentation updated (SKILL.md)
- [ ] Documentation updated (README.md)
- [ ] Example config provided
- [ ] Manual testing on 3 platforms
- [ ] OpenSpec validation passes
