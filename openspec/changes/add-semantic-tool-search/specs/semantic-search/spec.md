# Semantic Search Capability

## ADDED Requirements

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
## Search Results

| Tool | Confidence | Reason |
|------|-----------|--------|
| desktop-commander__read_file | 0.92 | Semantic similarity (file operations) |
| filesystem__read | 0.85 | Fuzzy match + domain boost |

\`\`\`typescript
// Auto-generated TypeScript client for MCP tools
// DO NOT EDIT - generated by toolscript gateway

export interface DesktopCommanderReadFileParams {
  path: string;
}

export interface DesktopCommanderReadFileResult {
  content: string;
}

export interface FilesystemReadParams {
  file_path: string;
}

export interface FilesystemReadResult {
  [key: string]: unknown;
}

export const tools = {
  desktopCommander: {
    /**
     * Read file contents from disk
     */
    async read_file(params: DesktopCommanderReadFileParams): Promise<DesktopCommanderReadFileResult> {
      const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
      if (!url) throw new Error("TOOLSCRIPT_GATEWAY_URL not set");
      const response = await fetch(`${url}/tools/desktop-commander__read_file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.statusText}`);
      }
      return await response.json();
    }
  },
  filesystem: {
    /**
     * Read file from filesystem
     */
    async read(params: FilesystemReadParams): Promise<FilesystemReadResult> {
      const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
      if (!url) throw new Error("TOOLSCRIPT_GATEWAY_URL not set");
      const response = await fetch(`${url}/tools/filesystem__read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error(`Tool call failed: ${response.statusText}`);
      }
      return await response.json();
    }
  }
};
\`\`\`

Usage example:
\`\`\`typescript
import { tools } from "toolscript";

// Call tools using the generated client
const result = await tools.desktopCommander.read_file({ path: "file.txt" });
\`\`\`
```

#### Scenario: No results found
**GIVEN** query has no semantic or keyword matches above threshold
**WHEN** user runs search
**THEN** the system displays "No tools found matching query"
**AND** suggests trying different keywords or lowering threshold with --threshold flag

### Requirement: Gateway Search Endpoint
The system **MUST** expose `/search` HTTP endpoint for programmatic tool discovery.

#### Scenario: Search endpoint invocation
**WHEN** client sends GET request to `/search?q=find+files&limit=5`
**THEN** gateway returns JSON response:
```json
{
  "query": "find files",
  "results": [
    {
      "toolId": "desktop-commander__search_files",
      "serverName": "desktop-commander",
      "toolName": "search_files",
      "confidence": 0.89,
      "reason": "Semantic similarity (file operations)",
      "description": "Search for files by name pattern"
    }
  ],
  "totalResults": 1,
  "threshold": 0.35
}
```

#### Scenario: Search endpoint error handling
**GIVEN** search engine is not initialized
**WHEN** client calls `/search` endpoint
**THEN** gateway returns HTTP 503 Service Unavailable
**AND** error message indicates search engine not ready

### Requirement: Advanced Configuration via Environment Variables
The system **MUST** support advanced configuration options via environment variables for tuning search behavior.

#### Scenario: Configure semantic weight (alpha) via environment
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_ALPHA=0.8`
**WHEN** search combines semantic and fuzzy scores
**THEN** final score = 0.8 * semantic + 0.2 * fuzzy
**AND** semantic matching is prioritized over keyword matching

#### Scenario: Default alpha value
**GIVEN** no alpha specified via environment
**WHEN** search combines scores
**THEN** the system uses default alpha of 0.7

#### Scenario: Disable embedding cache via environment
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_NO_CACHE=true`
**WHEN** gateway starts
**THEN** the system does not load cached embeddings
**AND** recomputes all embeddings on indexing
**AND** does not persist to disk

#### Scenario: Disable GPU acceleration via environment
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_DEVICE=cpu`
**WHEN** embedding model initializes
**THEN** the system uses CPU-only execution
**AND** does not attempt GPU acceleration

#### Scenario: Force GPU acceleration via environment
**GIVEN** environment variable `TOOLSCRIPT_SEARCH_DEVICE=gpu`
**WHEN** embedding model initializes
**THEN** the system attempts GPU acceleration
**AND** fails with error if GPU unavailable

### Requirement: Gateway Types Endpoint Enhancement
The system **MUST** enhance the `/runtime/tools.ts` endpoint to support filtering multiple servers and tools in a single call.

#### Scenario: Filter by server name
**WHEN** client requests `/runtime/tools.ts?filter=github`
**THEN** generated TypeScript includes all tools from the "github" server
**AND** output format matches existing get-types command structure

#### Scenario: Filter by specific tool
**WHEN** client requests `/runtime/tools.ts?filter=myserver__echo`
**THEN** generated TypeScript includes only the "echo" tool from "myserver"
**AND** output format matches existing get-types command structure

#### Scenario: Filter multiple servers and tools
**WHEN** client requests `/runtime/tools.ts?filter=github,myserver__echo,otherserver__read_file`
**THEN** generated TypeScript includes:
  - All tools from "github" server
  - "echo" tool from "myserver"
  - "read_file" tool from "otherserver"
**AND** output format matches existing get-types command structure

## MODIFIED Requirements

## REMOVED Requirements

None - this is a new capability.
