/**
 * Fuzzy search engine using Fuse.js for keyword-based matching
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import { getLogger } from "@logtape/logtape";
import type { FuzzyResult, ToolMetadata } from "./types.ts";

const logger = getLogger(["toolscript", "search", "fuzzy"]);

/**
 * Fuzzy search engine for keyword-based tool matching
 */
export class FuzzyEngine {
  private fuse: Fuse<ToolMetadata> | null = null;
  private tools: ToolMetadata[] = [];

  /**
   * Initialize fuzzy search index with tools
   */
  initialize(tools: ToolMetadata[]): void {
    this.tools = tools;
    this.buildIndex();
    logger.debug`Initialized fuzzy search with ${tools.length} tools`;
  }

  /**
   * Build Fuse.js index
   */
  private buildIndex(): void {
    const options: IFuseOptions<ToolMetadata> = {
      keys: [
        { name: "serverName", weight: 0.3 },
        { name: "toolName", weight: 0.5 },
        { name: "description", weight: 0.2 },
      ],
      threshold: 0.4, // Lower = stricter matching
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true, // Search entire string, not just beginning
      useExtendedSearch: false,
    };

    this.fuse = new Fuse(this.tools, options);
  }

  /**
   * Search for tools matching the query
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Fuzzy search results with scores
   */
  search(query: string, limit: number): FuzzyResult[] {
    if (!this.fuse) {
      logger.warn`Fuzzy search not initialized`;
      return [];
    }

    const results = this.fuse.search(query, { limit });

    return results.map((result) => ({
      toolId: result.item.toolId,
      // Fuse.js score is 0 (perfect match) to 1 (no match)
      // Invert it so higher is better (1 = perfect, 0 = no match)
      score: 1 - (result.score ?? 1),
    }));
  }

  /**
   * Add a new tool to the index
   */
  addTool(tool: ToolMetadata): void {
    this.tools.push(tool);
    this.buildIndex();
    logger.debug`Added tool ${tool.toolId} to fuzzy index`;
  }

  /**
   * Remove a tool from the index
   */
  removeTool(toolId: string): void {
    const index = this.tools.findIndex((t) => t.toolId === toolId);
    if (index >= 0) {
      this.tools.splice(index, 1);
      this.buildIndex();
      logger.debug`Removed tool ${toolId} from fuzzy index`;
    }
  }

  /**
   * Get number of indexed tools
   */
  getToolCount(): number {
    return this.tools.length;
  }

  /**
   * Clear all tools from index
   */
  clear(): void {
    this.tools = [];
    this.fuse = null;
    logger.debug`Cleared fuzzy search index`;
  }
}
