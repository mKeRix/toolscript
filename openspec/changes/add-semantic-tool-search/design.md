# Design Document: Semantic Tool Search

## Architecture Overview

The semantic search feature adds a new search engine layer between the CLI/Gateway and the tool registry. It operates independently of the existing list-based discovery but shares the same tool metadata source.

```
┌─────────────────────────────────────────────────────┐
│  CLI / Gateway                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │ search cmd   │  │ list cmds    │  │ /search    ││
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘│
│         │                 │                 │        │
└─────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │
    ┌─────▼─────────────────▼─────────────────▼──────┐
    │  Discovery Layer                                │
    │  ┌──────────────────┐  ┌──────────────────────┐│
    │  │ Search Engine    │  │ Direct Listing       ││
    │  │ (NEW)            │  │ (Existing)           ││
    │  └────────┬─────────┘  └──────────────────────┘│
    └───────────┼─────────────────────────────────────┘
                │
    ┌───────────▼─────────────────────────────────────┐
    │  Tool Registry (Aggregator)                     │
    │  - Tool metadata from all MCP servers           │
    │  - Server connection management                 │
    └─────────────────────────────────────────────────┘
```

## Component Design

### 1. Search Engine (`src/search/engine.ts`)

Primary search orchestrator that coordinates semantic and fuzzy search.

**Key Methods:**
```typescript
class SearchEngine {
  async initialize(): Promise<void>
  async search(query: string, limit: number, threshold: number): Promise<SearchResult[]>
  async indexTool(tool: ToolMetadata): Promise<void>
  getStats(): SearchStats
}
```

**Responsibilities:**
- Lazy-load embedding model on first search
- Coordinate semantic and fuzzy search subsystems
- Combine scores using configured alpha weighting
- Filter results by confidence threshold
- Manage search cache lifecycle

### 2. Semantic Engine (`src/search/semantic.ts`)

Handles transformer-based vector similarity search.

**Key Methods:**
```typescript
class SemanticEngine {
  async initialize(modelName: string, device: string): Promise<void>
  async embed(text: string): Promise<Float32Array>
  async findSimilar(queryEmbedding: Float32Array, limit: number): Promise<SimilarityResult[]>
  async indexEmbedding(toolId: string, embedding: Float32Array): Promise<void>
}
```

**Responsibilities:**
- Load and manage transformer model via @xenova/transformers
- Generate embeddings for tool metadata and queries
- Compute cosine similarity scores
- Detect and utilize Apple Silicon GPU via Metal backend
- Persist/load embedding cache

**Implementation Details:**
- Use `@xenova/transformers` pipeline for embeddings
- Default model: `Xenova/bge-small-en-v1.5` (quantized, ~45MB, MTEB Retrieval: 51.68)
- Alternative model: `Xenova/all-MiniLM-L6-v2` (quantized, ~25MB, smaller/faster)
- Embedding dimension: 384 (both models)
- Pooling: mean pooling with normalization
- Cache format: JSON with Float32Array serialized to regular arrays
- BGE models use query prefix: "Represent this sentence for searching relevant passages: "

**GPU Acceleration Support:**
```typescript
// Auto-detect GPU backend
const { pipeline, env } = await import('@xenova/transformers');

// Get device preference from environment or default to 'auto'
const device = Deno.env.get('TOOLSCRIPT_SEARCH_DEVICE') || 'auto';

if (device === 'gpu' || device === 'auto') {
  try {
    // Attempt GPU acceleration
    // Metal (Apple Silicon), CUDA (NVIDIA), ROCm (AMD), WebGPU
    env.backends.onnx.wasm.numThreads = 4;
    env.backends.onnx.wasm.simd = true;

    // Platform-specific GPU setup
    if (process.platform === 'darwin' && process.arch === 'arm64') {
      // Apple Silicon Metal backend
      logger.debug('Using Metal GPU acceleration');
    } else if (env.backends.onnx.cuda?.available) {
      // NVIDIA CUDA backend
      logger.debug('Using CUDA GPU acceleration');
    }

    if (device === 'gpu' && !gpuDetected) {
      throw new Error('GPU requested but not available');
    }
  } catch (error) {
    if (device === 'gpu') throw error;
    logger.warn('GPU acceleration failed, falling back to CPU');
  }
}
```

### 3. Fuzzy Engine (`src/search/fuzzy.ts`)

Handles keyword-based fuzzy search using Fuse.js.

**Key Methods:**
```typescript
class FuzzyEngine {
  initialize(tools: ToolMetadata[]): void
  search(query: string, limit: number): Promise<FuzzyResult[]>
  addTool(tool: ToolMetadata): void
}
```

**Responsibilities:**
- Maintain Fuse.js index of tool names and descriptions
- Provide typo-tolerant keyword matching
- Serve as fallback when semantic engine unavailable

**Configuration:**
```typescript
const fuseOptions = {
  keys: [
    { name: 'serverName', weight: 0.3 },
    { name: 'toolName', weight: 0.5 },
    { name: 'description', weight: 0.2 }
  ],
  threshold: 0.4,  // Lower = stricter matching
  includeScore: true,
  minMatchCharLength: 2
};
```

### 4. Embedding Cache (`src/search/cache.ts`)

Manages persistent storage of tool embeddings with configuration-aware lookups.

**Cache Structure:**
```typescript
interface EmbeddingCache {
  version: string;
  model: string;
  configHash: string;
  embeddings: {
    [toolId: string]: {
      embedding: number[];  // Float32Array serialized
      hash: string;         // Tool metadata hash (description + schema)
      timestamp: string;
    }
  };
}
```

**Cache Location:**
- Default: `$HOME/.toolscript/cache/embeddings/`
- Custom: `$TOOLSCRIPT_DATA_DIR/cache/embeddings/` or via `--data-dir` flag
- File naming: `embeddings-<config-hash>.json` (allows multiple configs)

**Configuration Hash:**
```typescript
// SHA256 hash of sorted MCP server list
function computeConfigHash(config: ToolscriptConfig): string {
  const servers = Object.keys(config.mcpServers).sort();
  return crypto.createHash('sha256')
    .update(JSON.stringify(servers))
    .digest('hex')
    .substring(0, 16); // Use first 16 chars
}
```

**Cache Invalidation:**
- Configuration hash mismatch (servers added/removed) → new cache file
- Tool metadata hash change (description/schema updated) → regenerate tool embedding
- Model change (different model name) → invalidate entire cache
- Cache corruption → rebuild from scratch

## Data Flow

### Indexing Flow
```
MCP Server Connect
  → Tool Metadata Extracted
  → Embedding Generated (if model loaded)
  → Embedding Cached to Disk ($DATA_DIR/cache/embeddings/)
  → Fuzzy Index Updated
```

### Search Flow (Table Output)
```
User Query
  → Lazy-load Model (if not initialized)
  → Generate Query Embedding
  → Compute Semantic Similarities
  → Execute Fuzzy Search
  → Combine Scores (alpha weighting)
  → Filter by Threshold
  → Return Top N Results
  → Format as Table
```

### Search Flow (Types Output)
```
User Query
  → [Same search process as above]
  → Filter Top N Results
  → Build confidence table in Markdown
  → Extract tool IDs from results (e.g., "desktop-commander__read_file,filesystem__read")
  → Call /runtime/tools.ts?filter=<tool-ids>
  → Gateway returns TypeScript module (standard format, no confidence in JSDoc)
  → Prepend confidence table to TypeScript code block
  → Format as Markdown code block with usage example
  → Return to CLI
```

## Configuration via CLI and Environment Variables

**No `.toolscript.json` changes** - all configuration via CLI flags and environment variables.

### CLI Flags

```bash
toolscript search <query> \
  --model <model-name> \          # Default: Xenova/bge-small-en-v1.5
  --limit <n> \                   # Default: 3
  --threshold <score> \           # Default: 0.35
  --output <format> \             # Default: table | Options: types
  --data-dir <path>               # Default: $HOME/.toolscript
```

### Environment Variables

```bash
# Model and device
export TOOLSCRIPT_SEARCH_MODEL=Xenova/all-MiniLM-L6-v2  # Default: bge-small-en-v1.5
export TOOLSCRIPT_SEARCH_DEVICE=cpu                      # Default: auto | Options: cpu, gpu, auto

# Search parameters
export TOOLSCRIPT_SEARCH_LIMIT=5                         # Default: 3
export TOOLSCRIPT_SEARCH_THRESHOLD=0.4                   # Default: 0.35
export TOOLSCRIPT_SEARCH_ALPHA=0.8                       # Default: 0.7 (semantic weight)

# Data and caching
export TOOLSCRIPT_DATA_DIR=/custom/path                  # Default: $HOME/.toolscript
export TOOLSCRIPT_SEARCH_NO_CACHE=true                   # Default: false
```

### Defaults Summary

| Parameter | Default | Description |
|-----------|---------|-------------|
| model | `Xenova/bge-small-en-v1.5` | Embedding model (best retrieval performance) |
| device | `auto` | GPU if available, CPU fallback |
| limit | `3` | Max results to return |
| threshold | `0.35` | Min confidence score to include |
| alpha | `0.7` | Semantic weight (70% semantic, 30% fuzzy) |
| cache | `enabled` | Use persistent embedding cache |
| output | `table` | CLI output format |

## File Structure

```
src/
  search/
    engine.ts          # Main search orchestrator
    semantic.ts        # Transformer-based similarity
    fuzzy.ts           # Fuse.js keyword search
    cache.ts           # Embedding persistence
    types.ts           # Search-related types

  cli/
    commands/
      search.ts        # New search command
      types.ts         # Existing (may be modified to share formatting logic)
      list.ts          # Existing (unchanged)

  gateway/
    routes/
      search.ts        # New /search endpoint
    server.ts          # Modified: /runtime/tools.ts endpoint with filter parameter support
```

## Performance Considerations

### Cold Start
- **First invocation**: 2-5s (model download + initialization)
- **Subsequent**: <100ms (cached embeddings)

### Memory Usage
- **Model in memory**: ~50MB (quantized)
- **Embedding cache**: ~1-2MB per 100 tools
- **Total overhead**: ~100MB for typical use

### Disk Usage
- **Model cache**: ~25MB (downloaded once)
- **Embedding cache**: ~5-10MB for 500 tools

### Optimization Strategies
1. **Lazy loading**: Don't initialize until first search
2. **Quantization**: Use int8 quantized models
3. **Batching**: Batch embedding generation during indexing
4. **Progressive indexing**: Index tools as servers connect

## Error Handling

### Model Load Failure
```typescript
try {
  await semanticEngine.initialize();
} catch (error) {
  logger.warn('Semantic engine failed, using fuzzy-only mode');
  this.semanticAvailable = false;
}
```

### Cache Corruption
```typescript
try {
  await cache.load();
} catch (error) {
  logger.warn('Cache corrupted, rebuilding');
  await cache.clear();
}
```

### Search Timeout
```typescript
const searchPromise = this.search(query);
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Search timeout')), 10000)
);

const results = await Promise.race([searchPromise, timeout]);
```

## Testing Strategy

### Unit Tests
- Embedding generation accuracy
- Similarity computation correctness
- Cache persistence and loading
- Score fusion logic

### Integration Tests
- End-to-end search with real MCP servers
- Cache invalidation scenarios
- Fallback to fuzzy search
- Apple Silicon GPU detection

### E2E Tests
- CLI search command output
- Gateway /search endpoint responses
- Configuration changes applied correctly

## Migration Path

1. **Phase 1**: Add search engine (this change)
2. **Phase 2**: Update skill documentation to recommend search
3. **Phase 3**: Collect usage metrics and tune defaults
4. **Phase 4**: Consider deprecating list commands (future)

## Model Options

### Supported Models

```typescript
const SUPPORTED_MODELS = {
  'Xenova/bge-small-en-v1.5': {
    dimensions: 384,
    size: 45,      // MB
    parameters: '33.4M',
    mtebRetrieval: 51.68,
    speed: 'medium',
    quality: 'best-for-retrieval',
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
    useCase: 'Default - optimized for retrieval tasks'
  },
  'Xenova/all-MiniLM-L6-v2': {
    dimensions: 384,
    size: 25,      // MB
    parameters: '22.7M',
    mtebRetrieval: null,  // No published retrieval scores
    speed: 'fast',
    quality: 'good-general',
    queryPrefix: null,
    useCase: 'Alternative - smaller/faster, general similarity'
  },
  'Xenova/all-mpnet-base-v2': {
    dimensions: 768,
    size: 438,     // MB
    parameters: '109M',
    mtebRetrieval: 43.81,
    speed: 'slow',
    quality: 'large-but-lower-retrieval',
    queryPrefix: null,
    useCase: 'Not recommended - larger but worse retrieval than bge-small'
  }
};
```

**Default**: `Xenova/bge-small-en-v1.5`
- Best MTEB retrieval score (51.68) in compact size
- Purpose-built for retrieval tasks
- Query prefix optimization for better results
- Modest size increase vs MiniLM justified by performance

**Why bge-small over all-MiniLM-L6-v2?**
1. Tool search is a **retrieval task**, not general similarity
2. BGE models specifically optimized for retrieval (51.68 vs no published scores)
3. Outperforms larger models (vs mpnet-base: 51.68 vs 43.81)
4. Size penalty acceptable: +20MB (~45MB vs ~25MB) for better accuracy

## Open Design Questions

1. **How to handle tool schema changes during runtime?**
   - Initial: Async cache update, eventual consistency
   - Future: Real-time incremental updates

2. **Should search support filters (by server, by domain)?**
   - Initial: No filters, rely on query refinement
   - Future: Add `--server <name>` flag

## Security Considerations

1. **Model provenance**: Only load models from trusted HuggingFace repos
2. **Cache tampering**: Validate cache checksums before loading
3. **Query injection**: Sanitize user queries before embedding
4. **Resource limits**: Cap max embedding batch size to prevent DoS
