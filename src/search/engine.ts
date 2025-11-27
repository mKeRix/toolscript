/**
 * Main search orchestrator that coordinates semantic and fuzzy search
 */

import { getLogger } from "@logtape/logtape";
import { computeConfigHash, EmbeddingCache } from "./cache.ts";
import { FuzzyEngine } from "./fuzzy.ts";
import { SemanticEngine } from "./semantic.ts";
import type { SearchConfig, SearchResult, SearchStats, ToolMetadata } from "./types.ts";
import { DEFAULT_SEARCH_CONFIG } from "./types.ts";

const logger = getLogger(["toolscript", "search", "engine"]);

/**
 * Main search engine coordinating semantic and fuzzy search
 */
export class SearchEngine {
  private config: SearchConfig;
  private semanticEngine: SemanticEngine | null = null;
  private fuzzyEngine: FuzzyEngine;
  private cache: EmbeddingCache | null = null;
  private tools: Map<string, ToolMetadata> = new Map();
  private semanticAvailable = false;
  private initialized = false;

  constructor(config: Partial<SearchConfig> = {}) {
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
    this.fuzzyEngine = new FuzzyEngine();
  }

  /**
   * Initialize the search engine with tools
   */
  async initialize(serverNames: string[]): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info`Initializing search engine`;

    // Initialize cache
    const configHash = computeConfigHash(serverNames);
    this.cache = new EmbeddingCache(
      this.config.model,
      configHash,
      this.config.dataDir,
    );

    if (this.config.enableCache) {
      await this.cache.initialize();
    }

    // Initialize semantic engine with graceful degradation
    try {
      this.semanticEngine = new SemanticEngine(
        this.config.model,
        this.config.device,
        this.config.dataDir,
      );
      await this.semanticEngine.initialize();
      this.semanticAvailable = true;
      logger.info`Semantic search enabled`;
    } catch (error) {
      logger.warn`Semantic search unavailable, using fuzzy-only mode: ${error}`;
      this.semanticAvailable = false;
    }

    this.initialized = true;
  }

  /**
   * Index multiple tools
   */
  async indexTools(tools: ToolMetadata[]): Promise<void> {
    // Initialize fuzzy engine with all tools at once for efficiency
    this.fuzzyEngine.initialize(tools);

    // Index each tool for semantic search
    for (const tool of tools) {
      this.tools.set(tool.toolId, tool);

      if (this.semanticAvailable && this.semanticEngine) {
        try {
          let embedding = this.cache?.get(tool);

          if (!embedding) {
            embedding = await this.semanticEngine.indexTool(tool);
            if (this.cache) {
              this.cache.set(tool, embedding);
            }
          } else {
            this.semanticEngine.indexEmbedding(tool, embedding);
          }
        } catch (error) {
          logger.error`Failed to index tool ${tool.toolId}: ${error}`;
        }
      }
    }

    // Save cache after bulk indexing
    if (this.cache && this.config.enableCache) {
      await this.cache.save();
    }

    logger.info`Indexed ${tools.length} tools`;
  }

  /**
   * Search for tools matching the query
   */
  async search(
    query: string,
    limit?: number,
    threshold?: number,
  ): Promise<SearchResult[]> {
    const effectiveLimit = limit ?? this.config.limit;
    const effectiveThreshold = threshold ?? this.config.threshold;

    // Get fuzzy results
    const fuzzyResults = this.fuzzyEngine.search(query, effectiveLimit * 2);

    // Get semantic results if available
    let semanticResults: { toolId: string; score: number }[] = [];
    if (this.semanticAvailable && this.semanticEngine) {
      try {
        semanticResults = await this.semanticEngine.findSimilar(
          query,
          effectiveLimit * 2,
        );
      } catch (error) {
        logger.error`Semantic search failed: ${error}`;
      }
    }

    // Combine results using hybrid fusion
    const combinedResults = this.fuseResults(
      semanticResults,
      fuzzyResults,
      effectiveLimit,
      effectiveThreshold,
    );

    return combinedResults;
  }

  /**
   * Fuse semantic and fuzzy results using alpha weighting
   */
  private fuseResults(
    semanticResults: { toolId: string; score: number }[],
    fuzzyResults: { toolId: string; score: number }[],
    limit: number,
    threshold: number,
  ): SearchResult[] {
    // When semantic is unavailable, use fuzzy-only scoring (alpha = 0)
    const alpha = this.semanticAvailable ? this.config.alpha : 0;
    const scoreMap = new Map<
      string,
      { semantic: number; fuzzy: number; combined: number }
    >();

    // Add semantic scores
    for (const result of semanticResults) {
      scoreMap.set(result.toolId, {
        semantic: result.score,
        fuzzy: 0,
        combined: alpha * result.score,
      });
    }

    // Add fuzzy scores
    for (const result of fuzzyResults) {
      const existing = scoreMap.get(result.toolId);
      if (existing) {
        existing.fuzzy = result.score;
        existing.combined = alpha * existing.semantic +
          (1 - alpha) * result.score;
      } else {
        scoreMap.set(result.toolId, {
          semantic: 0,
          fuzzy: result.score,
          combined: (1 - alpha) * result.score,
        });
      }
    }

    // Convert to SearchResult array
    const results: SearchResult[] = [];
    for (const [toolId, scores] of scoreMap.entries()) {
      // Apply threshold filter
      if (scores.combined < threshold) {
        continue;
      }

      const tool = this.tools.get(toolId);
      if (!tool) {
        continue;
      }

      results.push({
        tool,
        score: scores.combined,
        scoreBreakdown: {
          semantic: scores.semantic,
          fuzzy: scores.fuzzy,
          combined: scores.combined,
        },
        reason: this.generateReason(scores),
      });
    }

    // Sort by combined score (highest first)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Generate human-readable reason for match
   */
  private generateReason(scores: {
    semantic: number;
    fuzzy: number;
    combined: number;
  }): string {
    const parts: string[] = [];

    if (scores.semantic > 0.5) {
      parts.push("semantic match");
    } else if (scores.semantic > 0) {
      parts.push("partial semantic match");
    }

    if (scores.fuzzy > 0.7) {
      parts.push("strong keyword match");
    } else if (scores.fuzzy > 0.3) {
      parts.push("keyword match");
    }

    if (parts.length === 0) {
      return "weak match";
    }

    return parts.join(", ");
  }

  /**
   * Remove a tool from the index
   */
  removeTool(toolId: string): void {
    this.tools.delete(toolId);
    this.fuzzyEngine.removeTool(toolId);
    if (this.semanticEngine) {
      this.semanticEngine.removeTool(toolId);
    }
    logger.debug`Removed tool: ${toolId}`;
  }

  /**
   * Get search statistics
   */
  getStats(): SearchStats {
    const cacheStats = this.cache?.getStats() ?? { size: 0, hitRate: 0 };

    return {
      toolsIndexed: this.tools.size,
      cachedEmbeddings: cacheStats.size,
      model: this.config.model,
      semanticAvailable: this.semanticAvailable,
      cacheHitRate: cacheStats.hitRate,
    };
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if semantic search is available
   */
  isSemanticAvailable(): boolean {
    return this.semanticAvailable;
  }

  /**
   * Get tool by ID
   */
  getTool(toolId: string): ToolMetadata | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all indexed tools
   */
  getAllTools(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }

  /**
   * Clear all indexes and cache
   */
  async clear(): Promise<void> {
    this.tools.clear();
    this.fuzzyEngine.clear();
    if (this.semanticEngine) {
      this.semanticEngine.clear();
    }
    if (this.cache) {
      await this.cache.clear();
    }
    logger.info`Search engine cleared`;
  }

  /**
   * Dispose of resources and cleanup
   */
  async dispose(): Promise<void> {
    if (this.semanticEngine) {
      await this.semanticEngine.dispose();
    }
    if (this.cache) {
      await this.cache.save();
    }
    this.initialized = false;
    logger.debug`Search engine disposed`;
  }

  /**
   * Symbol.asyncDispose for explicit resource management (using pattern)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}
