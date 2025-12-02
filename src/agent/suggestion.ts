/**
 * Claude Agent SDK wrapper for intelligent context suggestion
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { join } from "@std/path";
import { exists } from "@std/fs";
import { getLogger } from "@logtape/logtape";
import type { Skill } from "../utils/skill-discovery.ts";

const logger = getLogger(["toolscript", "agent", "suggestion"]);

// Define schema with Zod
const SuggestionResultSchema = z.object({
  skills: z.array(z.string()).max(3).describe(
    "Relevant skill names from the available skills list",
  ),
  toolQueries: z.array(z.string()).max(3).describe("Search queries for finding relevant MCP tools"),
});

export type SuggestionResult = z.infer<typeof SuggestionResultSchema>;

/**
 * Load environment variables from ~/.claude/settings.json
 */
async function loadEnvFromSettings(): Promise<Record<string, string>> {
  try {
    const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!home) return {};

    const settingsFile = join(home, ".claude", "settings.json");
    if (!await exists(settingsFile)) {
      return {};
    }

    const content = await Deno.readTextFile(settingsFile);
    const settings = JSON.parse(content);

    if (settings && typeof settings.env === "object" && settings.env !== null) {
      // Return the env object as a record
      return settings.env as Record<string, string>;
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * Create a prompt template for skill and tool selection
 */
function createPrompt(userPrompt: string, skills: Skill[]): string {
  const skillList = skills
    .map((s) => `- ${s.name}: ${s.description}`)
    .join("\n");

  return `You analyze user prompts and recommend relevant skills and tools.

User's request:
---
${userPrompt}
---

Available skills:
${skillList || "(No skills available)"}

Based on the user's request, identify:
1. Which skills (if any) from the list would be useful for this task
2. What types of MCP tools to search for (if the task could benefit from MCP tools)

Rules:
- Only include skills that are DIRECTLY relevant to the user's request
- For irrelevant prompts, return empty arrays
- Return ONE focused toolQuery per distinct action/intent (don't split unnecessarily)
- Each toolQuery should be specific and capture the complete intent (e.g., "kubernetes cluster management", "git operations")
- Maximum 3 skills and 3 tool queries, but prefer fewer focused queries over many generic ones
- Return empty arrays if nothing is relevant

Examples:
- User: "hello" → no skills, no queries
- User: "search for React hooks examples" → skills: ["react-dev"], queries: ["code search"]
- User: "list k8s servers" → skills: ["toolscript"], queries: ["kubernetes cluster management"]
- User: "what's the weather?" → no skills, queries: ["weather API"]
- User: "commit and push changes" → skills: ["git-flow"], queries: ["git operations"]`;
}

/**
 * Use Claude Agent SDK to suggest relevant skills and tool queries
 *
 * @param userPrompt The user's input prompt
 * @param skills Available skills from all sources
 * @param timeoutMs Timeout in milliseconds (default: 5000)
 * @returns Promise with suggested skills and tool queries
 */
export async function suggestContext(
  userPrompt: string,
  skills: Skill[],
  timeoutMs: number = 8000,
): Promise<SuggestionResult> {
  try {
    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const prompt = createPrompt(userPrompt, skills);
      logger.debug(`Calling Agent SDK with ${skills.length} skills`);

      // Load environment variables from settings.json
      const settingsEnv = await loadEnvFromSettings();

      // Merge with process env (process env overrides settings.json)
      const mergedEnv = {
        ...settingsEnv,
        ...Deno.env.toObject(),
      };

      // Convert Zod schema to JSON Schema
      const jsonSchema = zodToJsonSchema(SuggestionResultSchema, { $refStrategy: "none" });

      // Query the Agent SDK with structured output
      const response = query({
        prompt: prompt,
        options: {
          abortController,
          model: "haiku",
          allowedTools: [],
          maxTurns: 5,
          env: mergedEnv,
          outputFormat: {
            type: "json_schema",
            schema: jsonSchema,
          },
        },
      });

      // Get the structured result
      for await (const msg of response) {
        if (msg.type === "result") {
          clearTimeout(timeoutId);

          if (msg.subtype === "success" && msg.structured_output) {
            // Validate and parse with Zod
            const parsed = SuggestionResultSchema.safeParse(msg.structured_output);
            if (parsed.success) {
              logger.debug(
                `Suggestion result: ${parsed.data.skills.length} skills, ${parsed.data.toolQueries.length} queries`,
              );
              return parsed.data;
            } else {
              logger.error("Failed to validate structured output", { error: parsed.error });
            }
          }

          // Handle errors
          if (msg.subtype !== "success") {
            logger.error(`Agent SDK returned error: ${msg.subtype}`);
          }

          break;
        }
      }

      logger.debug("No assistant message received from Agent SDK");
      clearTimeout(timeoutId);
      return { skills: [], toolQueries: [] };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Handle all errors gracefully (auth errors, network errors, timeouts)
    // Return empty suggestions - session should never crash
    if (error instanceof Error && error.name === "AbortError") {
      logger.debug("Agent SDK request timed out");
    } else {
      logger.error(`Agent SDK error: ${error}`);
    }
    return { skills: [], toolQueries: [] };
  }
}
