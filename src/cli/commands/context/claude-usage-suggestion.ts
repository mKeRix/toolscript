/**
 * Claude usage suggestion command - Intelligent context injection for Claude Code hooks
 */

import { Command } from "@cliffy/command";
import { getLogger } from "@logtape/logtape";
import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { discoverAllSkills } from "../../../utils/skill-discovery.ts";
import { suggestContext } from "../../../agent/suggestion.ts";
import type { SearchResult } from "../../../search/types.ts";

const logger = getLogger(["toolscript", "context", "suggestion"]);

/**
 * Search the gateway for tools matching a query
 */
async function searchGatewayForTools(
  gatewayUrl: string,
  query: string,
  limit: number = 3,
): Promise<SearchResult[]> {
  try {
    const searchParams = new URLSearchParams({
      q: query,
      limit: String(limit),
    });

    const response = await fetch(`${gatewayUrl}/search?${searchParams}`);

    if (!response.ok) {
      return [];
    }

    const results: SearchResult[] = await response.json();
    return results;
  } catch {
    // Gateway not available or search failed
    return [];
  }
}

/**
 * Deduplicate and sort tools by score
 * Keeps the highest score for each unique toolId and returns top N results
 */
export function deduplicateAndSortTools(
  tools: SearchResult[],
  limit: number = 5,
): SearchResult[] {
  // Deduplicate tools by toolId, keeping the highest score for each tool
  const toolMap = new Map<string, SearchResult>();
  for (const tool of tools) {
    const existing = toolMap.get(tool.tool.toolId);
    // Keep this tool if it's new OR has a higher score than existing
    if (!existing || tool.score > existing.score) {
      toolMap.set(tool.tool.toolId, tool);
    }
  }

  // Sort by confidence score (highest first) and take top N
  return Array.from(toolMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Format context text from skills and tools
 */
export function formatContextText(skills: string[], tools: SearchResult[]): string {
  const parts: string[] = [];

  if (skills.length > 0) {
    parts.push(
      `The following skills may be helpful for this request:
${skills.map((s) => `- Skill("${s}")`).join("\n")}`,
    );
  }

  if (tools.length > 0) {
    const toolNames = tools.map((t) => t.tool.toolId).join(", ");
    parts.push(
      `Consider using Skill("toolscript") to access these MCP tools: ${toolNames}`,
    );
  }

  return parts.join("\n\n");
}

/**
 * Create hook JSON response
 */
export function createHookResponse(contextText: string): HookJSONOutput {
  if (contextText) {
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: contextText,
      },
    };
  }
  // Return empty object for no context - hook system will treat this as success
  return {};
}

/**
 * Claude usage suggestion command
 */
export const claudeUsageSuggestionCommand = new Command()
  .description("Generate intelligent context suggestions for Claude Code hooks")
  .option("-p, --prompt <text:string>", "User's prompt", { required: true })
  .option("-g, --gateway-url <url:string>", "Gateway URL")
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options) => {
    try {
      // 1. Discover all skills
      const skills = await discoverAllSkills();
      logger.debug(`Discovered ${skills.length} skills`);

      // 2. Use Agent SDK to suggest relevant skills and tool queries
      const suggestion = await suggestContext(options.prompt, skills);

      // 3. Search gateway for tools (if gateway URL provided and tool queries exist)
      let allTools: SearchResult[] = [];

      if (options.gatewayUrl && suggestion.toolQueries.length > 0) {
        logger.debug(`Searching gateway for ${suggestion.toolQueries.length} tool queries`);
        const toolSearches = suggestion.toolQueries.map((query) =>
          searchGatewayForTools(options.gatewayUrl!, query)
        );

        const toolResults = await Promise.all(toolSearches);
        allTools = toolResults.flat();

        // Deduplicate and sort tools
        allTools = deduplicateAndSortTools(allTools, 5);
        logger.debug(`Found ${allTools.length} unique tools after deduplication`);
      }

      // 4. Format context text
      const contextText = formatContextText(suggestion.skills, allTools);

      // 5. Create and output hook JSON response
      const hookResponse = createHookResponse(contextText);
      console.log(JSON.stringify(hookResponse, null, 2));
    } catch (error) {
      // On any error, output empty JSON (graceful fallback)
      logger.error("Error generating suggestion", { error });
      console.log(JSON.stringify({}, null, 2));
    }
  });
