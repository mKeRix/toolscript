/**
 * Configuration file loading and environment variable substitution.
 */

import { toolscriptConfigSchema } from "./schema.ts";
import type { ToolscriptConfig } from "./types.ts";

/**
 * Default configuration file path
 */
export const DEFAULT_CONFIG_PATH = "./.toolscript.json";

/**
 * Substitute environment variables in a string.
 * Supports ${VAR} and ${VAR:-default} syntax.
 *
 * @param value - The string to process
 * @returns The string with environment variables substituted
 */
function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([^}:]+)(?::-(.*?))?\}/g, (_, varName, defaultValue) => {
    const envValue = Deno.env.get(varName);
    if (envValue !== undefined) {
      return envValue;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    // If no default and variable not found, return empty string
    return "";
  });
}

/**
 * Recursively substitute environment variables in an object.
 *
 * @param obj - The object to process
 * @returns The object with environment variables substituted
 */
function substituteEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return substituteEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVarsInObject) as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsInObject(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Load configuration from a file.
 *
 * @param configPath - Path to the configuration file (defaults to ./.toolscript.json)
 * @returns The loaded and validated configuration, or null if file doesn't exist
 * @throws Error if configuration is invalid
 */
export async function loadConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
): Promise<ToolscriptConfig | null> {
  try {
    const content = await Deno.readTextFile(configPath);
    const rawConfig = JSON.parse(content);

    // Substitute environment variables
    const configWithEnv = substituteEnvVarsInObject(rawConfig);

    // Validate schema
    const validated = toolscriptConfigSchema.parse(configWithEnv);

    return validated;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Return null if config file doesn't exist
      return null;
    }
    throw error;
  }
}

/**
 * Create an empty configuration.
 *
 * @returns An empty configuration with no servers
 */
export function emptyConfig(): ToolscriptConfig {
  return {
    mcpServers: {},
  };
}
