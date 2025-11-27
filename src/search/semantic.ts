/**
 * Semantic search engine using transformer-based embeddings
 */

import { getLogger } from "@logtape/logtape";
import type { SimilarityResult, ToolMetadata } from "./types.ts";
import { SUPPORTED_MODELS } from "./types.ts";
import { getDefaultDataDir } from "../utils/paths.ts";

const logger = getLogger(["toolscript", "search", "semantic"]);

/**
 * Semantic search engine using vector embeddings
 */
export class SemanticEngine {
  // deno-lint-ignore no-explicit-any
  private pipelineInstance: any | null = null;
  private embeddings: Map<string, Float32Array> = new Map();
  private modelName: string;
  private device: "webgpu" | "cpu";
  private dataDir: string;
  private initialized = false;

  constructor(modelName: string, device: "webgpu" | "cpu" = "webgpu", dataDir?: string) {
    this.modelName = modelName;
    this.device = device;
    this.dataDir = dataDir || getDefaultDataDir();
  }

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info`Initializing semantic search with model ${this.modelName}`;

      const modelConfig = SUPPORTED_MODELS[this.modelName];
      if (!modelConfig) {
        throw new Error(`Unsupported model: ${this.modelName}`);
      }

      // Dynamic import to avoid loading native modules at parse time
      const { pipeline } = await import("@huggingface/transformers");

      // Use configured device (defaults to WebGPU for better performance)
      const modelCacheDir = `${this.dataDir}/models`;
      this.pipelineInstance = await pipeline(
        "feature-extraction",
        this.modelName,
        {
          dtype: "fp32", // Full precision for better accuracy
          device: this.device, // Use WebGPU by default, fallback to CPU if configured
          cache_dir: modelCacheDir, // Store models in toolscript data directory
          session_options: {
            logSeverityLevel: 3, // ERROR level - suppress warnings
          },
        },
      );
      logger.debug`Using model cache directory: ${modelCacheDir}`;

      this.initialized = true;
      logger.info`Semantic search engine initialized successfully`;
    } catch (error) {
      logger.error`Failed to initialize semantic engine: ${error}`;
      throw error;
    }
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<Float32Array> {
    if (!this.initialized || !this.pipelineInstance) {
      throw new Error("Semantic engine not initialized");
    }

    try {
      const modelConfig = SUPPORTED_MODELS[this.modelName];

      // Apply query prefix if model requires it (e.g., BGE models)
      const inputText = modelConfig.queryPrefix ? `${modelConfig.queryPrefix}${text}` : text;

      // Generate embedding with mean pooling and normalization
      const result = await this.pipelineInstance(inputText, {
        pooling: "mean",
        normalize: true,
      });

      // Convert to Float32Array
      const embedding = new Float32Array(result.data);

      return embedding;
    } catch (error) {
      logger.error`Failed to generate embedding: ${error}`;
      throw error;
    }
  }

  /**
   * Index a tool's embedding
   */
  indexEmbedding(tool: ToolMetadata, embedding: Float32Array): void {
    this.embeddings.set(tool.toolId, embedding);
    logger.debug`Indexed embedding for ${tool.toolId}`;
  }

  /**
   * Generate and index embedding for a tool
   */
  async indexTool(tool: ToolMetadata): Promise<Float32Array> {
    // Create searchable text from tool metadata
    const text = this.createSearchableText(tool);

    // Generate embedding
    const embedding = await this.embed(text);

    // Store in index
    this.indexEmbedding(tool, embedding);

    return embedding;
  }

  /**
   * Create searchable text from tool metadata
   */
  private createSearchableText(tool: ToolMetadata): string {
    // Combine server name, tool name, and description
    const parts = [
      tool.serverName,
      tool.toolName.replace(/_/g, " "), // Replace underscores with spaces
      tool.description,
    ];

    // Extract parameter information from input schema
    if (
      tool.inputSchema && typeof tool.inputSchema === "object" && "properties" in tool.inputSchema
    ) {
      const properties = tool.inputSchema.properties as Record<string, unknown>;
      const paramList = Object.entries(properties)
        .map(([name, schema]: [string, unknown]) => {
          // deno-lint-ignore no-explicit-any
          const desc = (schema as any)?.description || "";
          return desc ? `${name} (${desc})` : name;
        })
        .join(", ");

      if (paramList) {
        parts.push(`Inputs: ${paramList}`);
      }
    }

    return parts.filter(Boolean).join(" ");
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    // Embeddings are already normalized, so this simplifies to dot product
    // But we calculate it properly for robustness
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    return similarity;
  }

  /**
   * Find tools similar to query embedding
   */
  async findSimilar(query: string, limit: number): Promise<SimilarityResult[]> {
    if (!this.initialized) {
      throw new Error("Semantic engine not initialized");
    }

    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Compute similarities with all indexed tools
    const results: SimilarityResult[] = [];

    for (const [toolId, embedding] of this.embeddings.entries()) {
      const score = this.cosineSimilarity(queryEmbedding, embedding);
      results.push({ toolId, score });
    }

    // Sort by score (highest first) and limit
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Remove tool from index
   */
  removeTool(toolId: string): void {
    this.embeddings.delete(toolId);
    logger.debug`Removed tool ${toolId} from semantic index`;
  }

  /**
   * Get number of indexed tools
   */
  getIndexSize(): number {
    return this.embeddings.size;
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings.clear();
    logger.debug`Cleared semantic search index`;
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
