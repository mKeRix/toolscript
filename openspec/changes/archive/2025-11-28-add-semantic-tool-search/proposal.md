# Proposal: Add Semantic Tool Search

## Change ID
`add-semantic-tool-search`

## Overview
Add hybrid semantic + fuzzy keyword search for MCP tool discovery to improve LLM tool selection accuracy and user experience. This will become the primary discovery mechanism, with current list-based approaches serving as fallback.

## Problem Statement
Current tool discovery in toolscript requires:
1. Manual inspection via `list-servers` and `list-tools <server>` commands
2. LLMs to navigate hierarchical listings to find relevant tools
3. Token-heavy context for listing all available tools

This approach is:
- **Inefficient**: Requires multiple roundtrips and full tool listings
- **Error-prone**: LLMs may select suboptimal tools from long lists
- **Unscalable**: Performance degrades with many MCP servers and tools

## Proposed Solution
Implement a hybrid search engine that combines:

### 1. Semantic Search (Vector Similarity)
- Embed tool metadata (server name, tool name, description, input schema) using transformer model
- Generate query embeddings for natural language discovery queries
- Rank tools by cosine similarity to enable intent-based matching

### 2. Fuzzy Keyword Search
- Match tool names and descriptions using fuzzy string matching (Fuse.js)
- Handle typos and partial matches effectively
- Provide fallback when semantic model is unavailable

### 3. Hybrid Fusion
- Combine semantic and fuzzy scores with configurable weighting
- Support semantic enhancement with capability inference (e.g., shell → git operations)
- Enable domain-aware boosting for cross-domain disambiguation

## Key Features

### CLI Interface
New search command:
```bash
toolscript search <query> [--limit <n>] [--threshold <score>]
```

Example:
```bash
toolscript search "find files containing text" --limit 5
toolscript search "commit git changes" --threshold 0.4
```

### Model Configuration
Support configurable embedding models via CLI flags and environment variables:
```bash
# Via CLI
toolscript search "query" --model Xenova/bge-small-en-v1.5 --limit 5

# Via environment
export TOOLSCRIPT_SEARCH_MODEL=Xenova/bge-small-en-v1.5
export TOOLSCRIPT_SEARCH_DEVICE=auto  # auto-detect GPU
export TOOLSCRIPT_SEARCH_LIMIT=3
export TOOLSCRIPT_SEARCH_THRESHOLD=0.35
```

**Defaults:**
- Model: `Xenova/bge-small-en-v1.5` (MTEB Retrieval: 51.68, optimized for retrieval)
- Device: `auto` (GPU if available, CPU fallback)
- Limit: `3` results
- Threshold: `0.35` confidence
- Alpha: `0.7` (70% semantic, 30% fuzzy)

### Performance Optimizations
- **Persistent cache**: Store pre-computed embeddings to disk
- **Lazy initialization**: Load model only when search is used
- **Progressive indexing**: Index tools as servers connect
- **Apple Silicon support**: Leverage GPU acceleration when available

### Integration
- Update toolscript skill to recommend search over list commands
- Gateway exposes `/search` endpoint for programmatic access
- Backward compatible with existing list commands

## Success Criteria
1. Search completes in <2s for typical queries (cold start <5s)
2. Returns relevant tools in top 3 results for 80% of queries
3. Model cache <200MB disk space
4. Zero impact when search feature not used
5. Graceful degradation to keyword search if model fails

## Non-Goals
- Real-time embedding updates (cache invalidation is async)
- Custom user-trained models (preset models only)
- Multi-language support (English only initially)

## Risks & Mitigations

### Risk: Large model download (>40MB)
**Mitigation**:
- Use quantized lightweight models (bge-small-en-v1.5 ~45MB, all-MiniLM-L6-v2 ~25MB)
- Download only on first search invocation
- Provide progress feedback
- Allow smaller alternative via `--model` flag

### Risk: Slow cold start
**Mitigation**:
- Cache embeddings to disk after first indexing
- Use lazy initialization (no startup penalty if unused)
- Support disabling via config

### Risk: Incompatibility with Deno
**Mitigation**:
- Use @huggingface/transformers which supports Deno via NPM specifiers
- Fallback to pure-JS keyword search if transformers fail
- Test on macOS, Linux, Windows

## Alternatives Considered

### 1. Cloud-based embedding API (OpenAI, Cohere)
**Rejected**: Requires API keys, network calls, ongoing costs

### 2. SQLite FTS (Full-Text Search)
**Rejected**: Lacks semantic understanding, pure keyword matching

### 3. BM25 ranking algorithm
**Rejected**: Better than simple keyword but still misses semantic intent

## Dependencies
- `@huggingface/transformers` (NPM): Embedding model inference
- `fuse.js` (NPM): Fuzzy keyword search
- `@xenova/transformers` models: Pre-trained embedding models

## Timeline Estimate
This is a planning document; execution timeline determined by implementation team.

## Resolved Design Decisions

1. **Model selection**: Use `bge-small-en-v1.5` as default
   - Best MTEB retrieval performance (51.68) in compact size
   - Configurable via `--model` flag and `TOOLSCRIPT_SEARCH_MODEL` env var
   - Lock to verified Xenova models for compatibility

2. **Configuration approach**: CLI/env vars only, no `.toolscript.json` changes
   - Keeps config file simple and focused on MCP servers
   - Allows per-session customization
   - Environment variables for persistent preferences

3. **Defaults**: limit=3, threshold=0.35, alpha=0.7
   - Based on ncp research and retrieval task characteristics
   - Configurable via CLI flags and environment variables

4. **GPU support**: Generic, not Apple Silicon-only
   - Auto-detect Metal, CUDA, ROCm, WebGPU
   - Fallback to CPU on failure
   - Configurable via `TOOLSCRIPT_SEARCH_DEVICE` env var

5. **Types output**: `--output types` for LLM workflow
   - Returns TypeScript code with confidence in comments
   - Enables single-command workflow: search → code
   - Table output remains default for human browsing

## References
- NCP implementation: https://github.com/portel-dev/ncp (RAG-based semantic search)
- HuggingFace Transformers.js: https://huggingface.co/docs/transformers.js
- Fuse.js fuzzy search: https://fusejs.io/
