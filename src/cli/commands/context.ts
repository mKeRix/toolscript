/**
 * Context command group - Commands for generating context suggestions
 */

import { Command } from "@cliffy/command";
import { claudeUsageSuggestionCommand } from "./context/claude-usage-suggestion.ts";

/**
 * Context command group
 */
export const contextCommand = new Command()
  .description("Generate context suggestions for Claude Code")
  .command("claude-usage-suggestion", claudeUsageSuggestionCommand);
