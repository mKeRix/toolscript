/**
 * Shared utilities for TypeScript types output formatting
 */

import { dedent } from "@std/text/unstable-dedent";
import { toCamelCase } from "../../types/naming.ts";

/**
 * Options for fetching and outputting TypeScript types
 */
export interface TypesOutputOptions {
  gatewayUrl: string;
  filter?: string;
  preamble?: string;
  usageExample?: {
    serverName: string;
    toolName?: string;
  };
}

/**
 * Fetch TypeScript types from the gateway
 */
export async function fetchTypes(
  gatewayUrl: string,
  filter?: string,
): Promise<string> {
  let url = `${gatewayUrl}/runtime/tools.ts`;
  if (filter) {
    url += `?filter=${encodeURIComponent(filter)}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch types: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Format TypeScript types with usage example
 */
export function formatTypesOutput(
  typesCode: string,
  options: Omit<TypesOutputOptions, "gatewayUrl">,
): string {
  const { preamble, filter, usageExample } = options;

  // Determine example server and tool names
  const exampleServer = usageExample?.serverName ||
    filter?.split(",")[0]?.split("__")[0] || "serverName";
  const exampleServerCamel = toCamelCase(exampleServer);
  const exampleToolCamel = usageExample?.toolName
    ? toCamelCase(usageExample.toolName)
    : "someMethod";

  // Build output
  const parts = [];

  if (preamble) {
    parts.push(preamble);
    parts.push(""); // blank line
  }

  parts.push(dedent`
    \`\`\`typescript
    ${typesCode}
    \`\`\`

    Usage example:
    \`\`\`typescript
    import { tools } from "toolscript";

    // Call tools using the generated client
    const result = await tools.${exampleServerCamel}.${exampleToolCamel}(params);
    \`\`\`
  `);

  return parts.join("\n");
}
