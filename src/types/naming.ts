/**
 * Naming convention conversion utilities.
 * Converts MCP server/tool names to TypeScript-compatible identifiers.
 */

/**
 * Convert a string to camelCase.
 * Handles snake_case, kebab-case, and other formats.
 *
 * @param str - The string to convert
 * @returns The camelCase version
 */
export function toCamelCase(str: string): string {
  // Remove invalid characters (keep alphanumeric, underscore, hyphen)
  let cleaned = str.replace(/[^a-zA-Z0-9_-]/g, "");

  // Collapse multiple underscores/hyphens
  cleaned = cleaned.replace(/[_-]+/g, "_");

  // Split on underscores and hyphens
  const parts = cleaned.split(/[_-]/);

  // Convert to camelCase
  let result = parts
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");

  // Prefix with underscore if starts with number (after camelCase conversion)
  if (/^\d/.test(result)) {
    result = `_${result}`;
  }

  return result;
}

/**
 * Convert a string to PascalCase.
 * Handles snake_case, kebab-case, and other formats.
 *
 * @param str - The string to convert
 * @returns The PascalCase version
 */
export function toPascalCase(str: string): string {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert server and tool names to a TypeScript type name.
 *
 * @param serverName - The server name
 * @param toolName - The tool name
 * @returns The PascalCase type name
 */
export function toTypeName(serverName: string, toolName: string): string {
  const serverPascal = toPascalCase(serverName);
  const toolPascal = toPascalCase(toolName);
  return `${serverPascal}${toolPascal}`;
}

/**
 * Convert a server name to a namespace identifier.
 *
 * @param serverName - The server name
 * @returns The camelCase namespace identifier
 */
export function toNamespaceId(serverName: string): string {
  return toCamelCase(serverName);
}

/**
 * Convert a tool name to a function identifier.
 *
 * @param toolName - The tool name
 * @returns The camelCase function identifier
 */
export function toFunctionId(toolName: string): string {
  return toCamelCase(toolName);
}
