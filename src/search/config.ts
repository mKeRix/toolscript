/**
 * Search configuration utilities
 *
 * Note: Environment variable parsing is now handled by Cliffy in CLI commands.
 * This module only provides validation utilities.
 */

import type { SearchConfig } from "./types.ts";

/**
 * Validate search configuration
 */
export function validateSearchConfig(config: SearchConfig): string[] {
  const errors: string[] = [];

  if (config.limit < 1 || config.limit > 100) {
    errors.push("limit must be between 1 and 100");
  }

  if (config.threshold < 0 || config.threshold > 1) {
    errors.push("threshold must be between 0 and 1");
  }

  if (config.alpha < 0 || config.alpha > 1) {
    errors.push("alpha must be between 0 and 1");
  }

  if (!["webgpu", "cpu"].includes(config.device)) {
    errors.push("device must be 'webgpu' or 'cpu'");
  }

  return errors;
}
