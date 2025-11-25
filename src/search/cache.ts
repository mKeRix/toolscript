/**
 * Embedding cache management for persistent storage of tool embeddings
 */

import { getLogger } from "@logtape/logtape";
import type { EmbeddingCacheData, EmbeddingCacheEntry, ToolMetadata } from "./types.ts";

const logger = getLogger(["toolscript", "search", "cache"]);

/**
 * Computes a hash of tool metadata for cache validation
 */
function computeToolHash(tool: ToolMetadata): string {
  const content = JSON.stringify({
    description: tool.description,
    inputSchema: tool.inputSchema,
  });

  // Simple string-based hash for cache validation
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Computes configuration hash from server names
 */
export function computeConfigHash(serverNames: string[]): string {
  const sorted = [...serverNames].sort();
  const content = JSON.stringify(sorted);

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16).substring(0, 16);
}

/**
 * Embedding cache manager
 */
export class EmbeddingCache {
  private cache: EmbeddingCacheData;
  private cacheDir: string;
  private cacheFile: string;
  private hits = 0;
  private misses = 0;

  constructor(
    private model: string,
    private configHash: string,
    dataDir?: string,
  ) {
    const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
    const baseDir = dataDir || `${home}/.toolscript`;
    this.cacheDir = `${baseDir}/cache/embeddings`;
    this.cacheFile = `${this.cacheDir}/embeddings-${configHash}.json`;

    this.cache = {
      version: "1.0",
      model: this.model,
      configHash: this.configHash,
      embeddings: {},
    };
  }

  /**
   * Initialize cache directory and load existing cache if valid
   */
  async initialize(): Promise<void> {
    try {
      await Deno.mkdir(this.cacheDir, { recursive: true });
      await this.load();
    } catch (error) {
      logger.warn`Failed to initialize cache: ${error}`;
    }
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<void> {
    try {
      const content = await Deno.readTextFile(this.cacheFile);
      const data: EmbeddingCacheData = JSON.parse(content);

      // Validate cache
      if (data.version !== "1.0") {
        logger.warn`Cache version mismatch, rebuilding`;
        return;
      }

      if (data.model !== this.model) {
        logger.warn`Cache model mismatch (${data.model} != ${this.model}), rebuilding`;
        return;
      }

      if (data.configHash !== this.configHash) {
        logger.warn`Cache config mismatch, rebuilding`;
        return;
      }

      this.cache = data;
      logger.info`Loaded ${Object.keys(data.embeddings).length} cached embeddings`;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        logger.debug`No cache file found, starting fresh`;
      } else {
        logger.warn`Cache load failed: ${error}, starting fresh`;
      }
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    try {
      const content = JSON.stringify(this.cache, null, 2);
      await Deno.writeTextFile(this.cacheFile, content);
      logger.debug`Cache saved to ${this.cacheFile}`;
    } catch (error) {
      logger.error`Failed to save cache: ${error}`;
    }
  }

  /**
   * Get cached embedding for a tool
   */
  get(tool: ToolMetadata): Float32Array | null {
    const entry = this.cache.embeddings[tool.toolId];
    if (!entry) {
      this.misses++;
      return null;
    }

    // Validate tool hash
    const currentHash = computeToolHash(tool);
    if (entry.hash !== currentHash) {
      logger.debug`Tool metadata changed for ${tool.toolId}, invalidating cache entry`;
      delete this.cache.embeddings[tool.toolId];
      this.misses++;
      return null;
    }

    this.hits++;
    return new Float32Array(entry.embedding);
  }

  /**
   * Store embedding in cache
   */
  set(tool: ToolMetadata, embedding: Float32Array): void {
    const entry: EmbeddingCacheEntry = {
      embedding: Array.from(embedding),
      hash: computeToolHash(tool),
      timestamp: new Date().toISOString(),
    };

    this.cache.embeddings[tool.toolId] = entry;
  }

  /**
   * Clear all cached embeddings
   */
  async clear(): Promise<void> {
    this.cache.embeddings = {};
    await this.save();
    logger.info`Cache cleared`;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hitRate: number } {
    const size = Object.keys(this.cache.embeddings).length;
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return { size, hitRate };
  }
}
