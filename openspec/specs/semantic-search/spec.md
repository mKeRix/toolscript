# semantic-search Specification

## Purpose
TBD - created by archiving change add-semantic-tool-search. Update Purpose after archive.
## Requirements
### Requirement: Hybrid Search Engine
The system **MUST** provide a hybrid search engine that combines semantic vector similarity with fuzzy keyword matching to discover relevant MCP tools based on natural language queries.

#### Scenario: Natural language tool discovery
**GIVEN** multiple MCP servers are connected with various tools
**AND** the search engine has indexed all available tools
**WHEN** a user searches with natural language query "find files containing specific text"
**THEN** the system returns ranked tools with `search_code` or `grep` capabilities
**AND** results include confidence scores and match reasons
**AND** results are ordered by relevance (highest confidence first)

#### Scenario: Typo-tolerant keyword search
**GIVEN** a tool named `read_file` exists
**WHEN** a user searches with typo "read_fil"
**THEN** the system returns `read_file` as top result via fuzzy matching
**AND** confidence score reflects fuzzy match quality

#### Scenario: Semantic intent matching
**GIVEN** shell/terminal tools exist
**WHEN** a user searches "commit my changes to git"
**THEN** the system returns shell execution tools with boosted confidence
**AND** match reason indicates semantic capability inference (git operations)

### Requirement: Embedding Model Support
The system **MUST** support configurable transformer-based embedding models with hardware acceleration when available.

#### Scenario: Default model initialization
**GIVEN** no custom model is specified via CLI or environment
**WHEN** search is first invoked
**THEN** the system loads `Xenova/bge-small-en-v1.5` model
**AND** downloads model files to cache (~45MB quantized)
**AND** shows progress feedback during download
**AND** initializes in <5 seconds after download

#### Scenario: GPU acceleration
**GIVEN** the system detects GPU support (CUDA, Metal, ROCm, or other)
**WHEN** the embedding model is initialized
**THEN** the system attempts to enable GPU acceleration
**AND** falls back to CPU if GPU initialization fails
**AND** logs GPU status (enabled/disabled) at debug level

#### Scenario: Model selection via CLI
**GIVEN** user runs `toolscript search "query" --model Xenova/all-MiniLM-L6-v2`
**WHEN** search engine initializes
**THEN** the system loads the specified model
**AND** validates model compatibility with transformers.js
**AND** uses this model for the current search session

#### Scenario: Model selection via environment variable
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_MODEL=Xenova/all-MiniLM-L6-v2`
**WHEN** search command runs without --model flag
**THEN** the system loads the model from environment variable
**AND** validates model compatibility

#### Scenario: Query prefix for retrieval optimization
**GIVEN** BGE model family is being used (bge-small, bge-base, etc.)
**WHEN** query embedding is generated
**THEN** the system prepends "Represent this sentence for searching relevant passages: " to the query
**AND** does not modify tool description embeddings

#### Scenario: Graceful fallback on model failure
**GIVEN** embedding model fails to load (network error, incompatible platform)
**WHEN** search is invoked
**THEN** the system falls back to pure fuzzy keyword search
**AND** logs warning about degraded mode
**AND** search still returns results based on keyword matching

### Requirement: Persistent Embedding Cache
The system **MUST** cache pre-computed tool embeddings to disk with configuration-aware lookups to avoid regenerating on every restart.

#### Scenario: Cache location resolution
**GIVEN** no data directory is specified
**WHEN** search engine initializes
**THEN** cache is stored in `$HOME/.toolscript/cache/embeddings/`
**AND** directory is created if it does not exist

#### Scenario: Custom data directory via environment variable
**GIVEN** environment variable `TOOLSCRIPT_DATA_DIR=/custom/path`
**WHEN** search engine initializes
**THEN** cache is stored in `/custom/path/cache/embeddings/`
**AND** directory is created if it does not exist

#### Scenario: Custom data directory via CLI flag
**GIVEN** user runs `toolscript search "query" --data-dir /custom/path`
**WHEN** search engine initializes for this session
**THEN** cache is stored in `/custom/path/cache/embeddings/`

#### Scenario: Configuration-aware cache lookup
**GIVEN** multiple .toolscript.json configurations exist with different MCP servers
**WHEN** search engine initializes with a specific config
**THEN** the system computes configuration hash (SHA256 of sorted MCP server list)
**AND** looks up cache file named `embeddings-<config-hash>.json`
**AND** allows separate caches for different configurations

#### Scenario: Cache creation on first indexing
**GIVEN** no embedding cache exists for current configuration hash
**WHEN** MCP servers connect and tools are indexed
**THEN** the system computes embeddings for all tools
**AND** persists embeddings to `<cache-dir>/embeddings-<config-hash>.json`
**AND** stores metadata with model name, version, and tool hashes

#### Scenario: Cache validation on startup
**GIVEN** embedding cache exists for current configuration hash
**WHEN** toolscript gateway starts
**THEN** the system validates cache metadata (model name matches current model)
**AND** loads cached embeddings if valid (no re-computation)
**AND** invalidates cache if model changed or cache corrupted

#### Scenario: Incremental cache updates
**GIVEN** new MCP server is added to configuration
**WHEN** gateway reloads configuration
**THEN** configuration hash changes
**AND** the system creates new cache file for new config hash
**AND** recomputes all embeddings for new configuration

#### Scenario: Cache invalidation on schema change
**GIVEN** tool input schema is modified
**WHEN** tool is re-indexed
**THEN** the system detects schema hash change (per-tool hash of description + schema)
**AND** regenerates embedding for that tool
**AND** updates cache with new embedding

### Requirement: Search CLI Command
The system **MUST** provide a `search` command that accepts natural language queries and returns ranked tool matches with configurable output formats.

#### Scenario: Basic search invocation with default output
**WHEN** user runs `toolscript search "read file contents"`
**THEN** the system queries the search engine
**AND** displays top 3 results by default in table format:
```
Tool                          Confidence  Reason
desktop-commander__read_file  0.92        Semantic similarity (file operations)
filesystem__read              0.85        Fuzzy match + domain boost
Shell__cat                    0.78        Capability inference (shell → file ops)
```

#### Scenario: Limit results via CLI flag
**WHEN** user runs `toolscript search "database query" --limit 5`
**THEN** the system returns at most 5 results
**AND** results are highest confidence matches

#### Scenario: Limit results via environment variable
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_LIMIT=10`
**WHEN** user runs `toolscript search "query"` without --limit flag
**THEN** the system returns at most 10 results

#### Scenario: Confidence threshold filtering via CLI
**WHEN** user runs `toolscript search "obscure query" --threshold 0.5`
**THEN** the system filters out results below 0.5 confidence
**AND** may return empty result set if no tools meet threshold

#### Scenario: Confidence threshold via environment variable
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_THRESHOLD=0.4`
**WHEN** user runs `toolscript search "query"` without --threshold flag
**THEN** the system filters results using 0.4 threshold

#### Scenario: Default threshold and limit values
**GIVEN** no threshold or limit specified via CLI or environment
**WHEN** user runs `toolscript search "query"`
**THEN** the system uses default threshold of 0.35
**AND** the system uses default limit of 3

#### Scenario: TypeScript types output format
**WHEN** user runs `toolscript search "read file" --output types`
**THEN** the system makes two gateway calls:
  1. `/search?q=read+file&limit=3` to get ranked results
  2. `/runtime/tools.ts?filter=desktop-commander__read_file,filesystem__read` to get TypeScript module
**AND** returns TypeScript module in same format as `get-types` command
**AND** includes confidence scores in Markdown preamble before code block:
```markdown

