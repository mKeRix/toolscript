/**
 * Core types for the semantic search system
 */

/**
 * Tool metadata for indexing and search
 */
export interface ToolMetadata {
  /** Server name (e.g., "github") */
  serverName: string;
  /** Tool name (e.g., "create_repository") */
  toolName: string;
  /** Full tool identifier (server__tool) */
  toolId: string;
  /** Tool description */
  description: string;
  /** JSON schema for input parameters */
  inputSchema?: unknown;
}

/**
 * Search result with confidence score
 */
export interface SearchResult {
  /** Tool metadata */
  tool: ToolMetadata;
  /** Confidence score (0-1) */
  score: number;
  /** Score breakdown for debugging */
  scoreBreakdown: {
    semantic: number;
    fuzzy: number;
    combined: number;
  };
  /** Reason for match (for debugging/explanation) */
  reason?: string;
}

/**
 * Search configuration options
 */
export interface SearchConfig {
  /** Embedding model name */
  model: string;
  /** Device to use (auto, cpu, gpu) */
  device: "auto" | "cpu" | "gpu";
  /** Maximum number of results */
  limit: number;
  /** Minimum confidence threshold (0-1) */
  threshold: number;
  /** Alpha weighting for hybrid search (0-1, higher = more semantic) */
  alpha: number;
  /** Whether to enable embedding cache */
  enableCache: boolean;
  /** Custom data directory for cache */
  dataDir?: string;
}

/**
 * Similarity search result from semantic engine
 */
export interface SimilarityResult {
  toolId: string;
  score: number;
}

/**
 * Fuzzy search result
 */
export interface FuzzyResult {
  toolId: string;
  score: number;
}

/**
 * Search engine statistics
 */
export interface SearchStats {
  /** Number of tools indexed */
  toolsIndexed: number;
  /** Number of cached embeddings */
  cachedEmbeddings: number;
  /** Model name in use */
  model: string;
  /** Whether semantic search is available */
  semanticAvailable: boolean;
  /** Cache hit rate */
  cacheHitRate: number;
}

/**
 * Embedding cache entry
 */
export interface EmbeddingCacheEntry {
  /** Float32Array embedding serialized to regular array */
  embedding: number[];
  /** Hash of tool metadata (description + schema) */
  hash: string;
  /** Timestamp when cached */
  timestamp: string;
}

/**
 * Embedding cache file structure
 */
export interface EmbeddingCacheData {
  /** Cache format version */
  version: string;
  /** Model name used for embeddings */
  model: string;
  /** Configuration hash (server list) */
  configHash: string;
  /** Map of toolId to cache entry */
  embeddings: Record<string, EmbeddingCacheEntry>;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Model dimensions */
  dimensions: number;
  /** Model size in MB */
  size: number;
  /** Query prefix for embedding (optional) */
  queryPrefix?: string;
  /** Use case description */
  useCase: string;
}

/**
 * Supported embedding models
 */
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  "Xenova/bge-small-en-v1.5": {
    dimensions: 384,
    size: 45,
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    useCase: "Default - optimized for retrieval tasks",
  },
  "Xenova/all-MiniLM-L6-v2": {
    dimensions: 384,
    size: 25,
    useCase: "Alternative - smaller/faster, general similarity",
  },
};

/**
 * Default search configuration
 */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  model: "Xenova/bge-small-en-v1.5",
  device: "auto",
  limit: 3,
  threshold: 0.35,
  alpha: 0.7,
  enableCache: true,
};
