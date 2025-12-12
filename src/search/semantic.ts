/**
 * Semantic search engine using transformer-based embeddings
 */

import { getLogger } from "@logtape/logtape";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { SimilarityResult, ToolMetadata } from "./types.ts";
import { SUPPORTED_MODELS } from "./types.ts";
import { getDefaultDataDir } from "../utils/paths.ts";

const logger = getLogger(["toolscript", "search", "semantic"]);

/**
 * JSON Schema property with optional description
 */
interface JSONSchemaProperty {
  description?: string;
  [key: string]: unknown;
}

/**
 * Semantic search engine using vector embeddings
 */
export class SemanticEngine {
  private pipelineInstance: FeatureExtractionPipeline | null = null;
  private embeddings: Map<string, Float32Array> = new Map();
  private modelName: string;
  private device: "auto" | "webgpu" | "cpu";
  private actualDevice: "webgpu" | "cpu" | null = null;
  private dataDir: string;
  private initialized = false;

  constructor(modelName: string, device: "auto" | "webgpu" | "cpu" = "auto", dataDir?: string) {
    this.modelName = modelName;
    this.device = device;
    this.dataDir = dataDir || getDefaultDataDir();
  }

  /**
   * Create a pipeline with the specified device
   */
  private async createPipeline(
    device: "webgpu" | "cpu",
    modelCacheDir: string,
  ): Promise<FeatureExtractionPipeline> {
    const { pipeline } = await import("@huggingface/transformers");

    return await pipeline(
      "feature-extraction",
      this.modelName,
      {
        dtype: "fp32",
        device,
        cache_dir: modelCacheDir,
        session_options: {
          logSeverityLevel: 3, // ERROR level - suppress warnings
        },
      },
    );
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

      // Initialize pipeline with device selection and fallback logic
      const modelCacheDir = `${this.dataDir}/models`;

      if (this.device === "auto") {
        // Try WebGPU first, then fallback to CPU if it fails
        let webgpuAttempted = false;

        // First attempt: WebGPU (if available)
        try {
          if (typeof navigator !== "undefined" && "gpu" in navigator) {
            logger.info`Attempting to initialize with WebGPU acceleration`;
            webgpuAttempted = true;

            this.pipelineInstance = await this.createPipeline("webgpu", modelCacheDir);

            this.actualDevice = "webgpu";
            logger.info`Successfully initialized with WebGPU acceleration`;
          } else {
            logger.info`WebGPU not detected, using CPU`;
          }
        } catch (error) {
          // WebGPU initialization failed, fallback to CPU
          if (webgpuAttempted) {
            logger.warn`WebGPU initialization failed, falling back to CPU: ${error}`;
          }
        }

        // Second attempt: CPU (if WebGPU wasn't successful)
        if (!this.pipelineInstance) {
          logger.info`Initializing with CPU backend`;
          this.pipelineInstance = await this.createPipeline("cpu", modelCacheDir);
          this.actualDevice = "cpu";
          logger.info`Successfully initialized with CPU backend`;
        }
      } else {
        // User explicitly specified a device - respect their choice without fallback
        logger.info`Using configured device: ${this.device}`;

        this.pipelineInstance = await this.createPipeline(this.device, modelCacheDir);
        this.actualDevice = this.device;
        logger.info`Successfully initialized with ${this.device}`;
      }

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

      // Convert to Float32Array (result.data is a TypedArray that needs conversion)
      const embedding = new Float32Array(Array.from(result.data as ArrayLike<number>));

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
          const desc = (schema as JSONSchemaProperty)?.description || "";
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
   * Since embeddings are normalized (normalize: true in pipeline config),
   * cosine similarity equals the dot product
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have same dimension");
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    return dotProduct;
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

  /**
   * Get the actual device being used (after auto-detection)
   */
  getActualDevice(): "webgpu" | "cpu" | null {
    return this.actualDevice;
  }

  /**
   * Dispose of the pipeline and release resources
   */
  dispose(): void {
    // Clear embeddings to free memory
    this.embeddings.clear();
    this.initialized = false;
  }

  /**
   * Symbol.asyncDispose for explicit resource management (using pattern)
   */
  [Symbol.dispose](): void {
    this.dispose();
  }
}
