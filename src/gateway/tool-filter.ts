/**
 * Tool filtering utilities for MCP server configurations.
 */

/**
 * Tool filter configuration
 */
export interface ToolFilters {
  includeTools?: string[];
  excludeTools?: string[];
}

/**
 * Check if a tool should be included based on includeTools and excludeTools filters.
 *
 * @param toolName - The name of the tool to check
 * @param filters - The filter configuration
 * @returns true if the tool should be included, false otherwise
 *
 * Filter logic:
 * 1. If includeTools is specified, tool must be in the list
 * 2. If excludeTools is specified, tool must not be in the list
 * 3. Exclude filters are applied after include filters
 * 4. If no filters are specified, all tools are included
 */
export function shouldIncludeTool(
  toolName: string,
  filters: ToolFilters,
): boolean {
  const { includeTools, excludeTools } = filters;

  // If includeTools is specified, tool must be in the list
  if (includeTools && includeTools.length > 0) {
    if (!includeTools.includes(toolName)) {
      return false;
    }
  }

  // If excludeTools is specified, tool must not be in the list
  if (excludeTools && excludeTools.length > 0) {
    if (excludeTools.includes(toolName)) {
      return false;
    }
  }

  return true;
}
