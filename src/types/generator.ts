/**
 * Type generation from MCP tool schemas.
 */

import { compile } from "json-schema-to-typescript";
import { dedent } from "@std/text/unstable-dedent";
import { toFunctionId, toNamespaceId, toTypeName } from "./naming.ts";
import type { ToolInfo } from "../gateway/aggregator.ts";
import { getLogger } from "../utils/logger.ts";

const logger = getLogger("type-generator");

/**
 * Generate fallback interface when schema compilation fails
 */
function generateFallbackInterface(typeName: string, isResult = false): string {
  if (isResult) {
    // For result types without schema, use 'unknown' to allow any return type
    return `export type ${typeName} = unknown;`;
  }
  return `export interface ${typeName} {}`;
}

/**
 * Generate type interface from JSON schema
 */
async function generateTypeInterface(
  schema: unknown,
  typeName: string,
  isResult = false,
): Promise<string> {
  if (!schema || typeof schema !== "object") {
    return generateFallbackInterface(typeName, isResult);
  }

  try {
    const compiled = await compile(schema, typeName, {
      bannerComment: "",
      declareExternallyReferenced: false,
      unreachableDefinitions: true,
    });
    return compiled.trim();
  } catch (error) {
    logger.warn(`Failed to compile schema for ${typeName}: ${error}`);
    return generateFallbackInterface(typeName, isResult);
  }
}

/**
 * Generate function body for tool with outputSchema
 */
function generateStructuredResponseBody(resultTypeName: string): string {
  return dedent`
    const content = await response.json();
    if (!Array.isArray(content)) {
      throw new Error("Invalid MCP response: expected content array");
    }
    // Try structuredContent first, then parse text content as JSON
    for (const item of content) {
      if (item.structuredContent) {
        return item.structuredContent as ${resultTypeName};
      }
      if (item.type === "text" && item.text) {
        try {
          return JSON.parse(item.text) as ${resultTypeName};
        } catch {
          // Continue to next item if JSON parse fails
        }
      }
    }
    throw new Error("No structured content found in MCP response");
  `;
}

/**
 * Generate function body for tool without outputSchema
 */
function generateUnstructuredResponseBody(): string {
  return dedent`
    const content = await response.json();
    if (!Array.isArray(content)) {
      throw new Error("Invalid MCP response: expected content array");
    }
    // Single text block: try to parse as JSON, otherwise return text
    if (content.length === 1 && content[0].type === "text" && content[0].text) {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text;
      }
    }
    // Multiple blocks: render with empty lines between
    const blocks: string[] = [];
    for (const item of content) {
      if (item.type === "text" && item.text) {
        blocks.push(item.text);
      } else {
        blocks.push(JSON.stringify(item, null, 2));
      }
    }
    return blocks.join("\\n\\n");
  `;
}

/**
 * Generate tool function implementation
 */
function generateToolFunction(tool: ToolInfo, compact = false): string {
  const functionId = toFunctionId(tool.toolName);
  const paramsTypeName = `${toTypeName(tool.serverName, tool.toolName)}Params`;
  const resultTypeName = `${toTypeName(tool.serverName, tool.toolName)}Result`;

  const docComment = tool.description ? `/** ${tool.description} */\n    ` : "";

  // Compact mode: hide implementation
  if (compact) {
    return dedent`
      ${docComment}async ${functionId}(params: ${paramsTypeName}): Promise<${resultTypeName}> {
        // ...
      }
    `;
  }

  // Full mode: include implementation
  const responseBody = tool.outputSchema
    ? generateStructuredResponseBody(resultTypeName)
    : generateUnstructuredResponseBody();

  return dedent`
    ${docComment}async ${functionId}(params: ${paramsTypeName}): Promise<${resultTypeName}> {
      const url = Deno.env.get("TOOLSCRIPT_GATEWAY_URL");
      if (!url) throw new Error("TOOLSCRIPT_GATEWAY_URL not set");
      const response = await fetch(\`\${url}/tools/${tool.qualifiedName}\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error(\`Tool call failed: \${response.statusText}\`);
      }
      ${responseBody}
    }
  `;
}

/**
 * Generate TypeScript client code from tools
 */
export async function generateToolsModule(
  tools: ToolInfo[],
  _gatewayUrl: string,
  compact = false,
): Promise<string> {
  if (tools.length === 0) {
    return dedent`
      // No tools available
      export const tools = {};
    `;
  }

  // Group tools by server
  const toolsByServer = new Map<string, ToolInfo[]>();
  for (const tool of tools) {
    const existing = toolsByServer.get(tool.serverName) || [];
    existing.push(tool);
    toolsByServer.set(tool.serverName, existing);
  }

  const parts: string[] = [];

  // Header
  parts.push(dedent`
    // Auto-generated TypeScript client for MCP tools
    // DO NOT EDIT - generated by toolscript gateway
  `);
  parts.push("");

  // Generate type interfaces for each tool
  for (const tool of tools) {
    const paramsTypeName = `${toTypeName(tool.serverName, tool.toolName)}Params`;
    const resultTypeName = `${toTypeName(tool.serverName, tool.toolName)}Result`;

    const paramsInterface = await generateTypeInterface(tool.inputSchema, paramsTypeName);
    parts.push(paramsInterface);
    parts.push("");

    const resultInterface = await generateTypeInterface(tool.outputSchema, resultTypeName, true);
    parts.push(resultInterface);
    parts.push("");
  }

  // Generate tools object
  const serverNamespaces: string[] = [];
  for (const [serverName, serverTools] of toolsByServer) {
    const namespaceId = toNamespaceId(serverName);
    const toolFunctions = serverTools.map((tool) => {
      const fn = generateToolFunction(tool, compact);
      // Indent each line by 4 spaces
      return fn.split("\n").map((line) => `    ${line}`).join("\n");
    }).join(",\n");

    serverNamespaces.push(`  ${namespaceId}: {\n${toolFunctions},\n  }`);
  }

  parts.push(`export const tools = {\n${serverNamespaces.join(",\n")}\n};`);
  parts.push("");

  return parts.join("\n");
}

/**
 * In-memory cache for generated modules
 */
export class TypeCache {
  private cache: string | null = null;

  /**
   * Get cached module
   */
  get(): string | null {
    return this.cache;
  }

  /**
   * Set cached module
   */
  set(module: string): void {
    this.cache = module;
    logger.debug("Type cache updated");
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache = null;
    logger.debug("Type cache cleared");
  }
}
