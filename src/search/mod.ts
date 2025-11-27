/**
 * Semantic search module for MCP tool discovery
 *
 * Provides hybrid semantic + fuzzy search for finding relevant tools
 * based on natural language queries.
 *
 * @module
 */

export { SearchEngine } from "./engine.ts";
export { SemanticEngine } from "./semantic.ts";
export { FuzzyEngine } from "./fuzzy.ts";
export { computeConfigHash, EmbeddingCache } from "./cache.ts";
export { validateSearchConfig } from "./config.ts";

export type {
  EmbeddingCacheData,
  EmbeddingCacheEntry,
  FuzzyResult,
  ModelConfig,
  SearchConfig,
  SearchResult,
  SearchStats,
  SimilarityResult,
  ToolMetadata,
} from "./types.ts";

export { DEFAULT_SEARCH_CONFIG, SUPPORTED_MODELS } from "./types.ts";
