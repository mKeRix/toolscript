/**
 * Configuration file loading and environment variable substitution.
 */

import { toolscriptConfigSchema } from "./schema.ts";
import type { ToolscriptConfig } from "./types.ts";

/**
 * Default configuration file paths (comma-separated)
 * Loads user config from home directory, then project config from current directory
 */
export const DEFAULT_CONFIG_PATHS = "~/.toolscript.json,.toolscript.json";

/**
 * Expand tilde (~) to user home directory.
 *
 * @param path - Path that may start with ~/
 * @returns Expanded path with home directory
 * @throws Error if HOME or USERPROFILE environment variable is not set
 */
function expandTildePath(path: string): string {
  if (path.startsWith("~/")) {
    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
    if (!homeDir) {
      throw new Error("Cannot expand ~: HOME or USERPROFILE environment variable not set");
    }
    return homeDir + path.slice(1);
  }
  return path;
}

/**
 * Parse config paths from string or array.
 * Handles comma-separated strings and tilde expansion.
 *
 * @param input - Single path, comma-separated paths, or array of paths
 * @returns Array of expanded absolute paths
 */
function parseConfigPaths(input: string | string[]): string[] {
  const paths = typeof input === "string" ? input.split(",").map((p) => p.trim()) : input;
  return paths.map(expandTildePath);
}

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
 * Load a single config file.
 * Returns null if file doesn't exist, throws on parse/validation errors.
 *
 * @param path - Path to the configuration file
 * @returns The loaded configuration, or null if file doesn't exist
 * @throws Error if JSON parsing or validation fails
 */
async function loadSingleConfig(path: string): Promise<ToolscriptConfig | null> {
  try {
    const content = await Deno.readTextFile(path);
    const rawConfig = JSON.parse(content);
    const configWithEnv = substituteEnvVarsInObject(rawConfig);
    const validated = toolscriptConfigSchema.parse(configWithEnv);
    return validated;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound || error instanceof Deno.errors.PermissionDenied) {
      return null; // File doesn't exist or can't be read - this is OK
    }
    // Re-throw parse errors, validation errors, etc.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load config from ${path}: ${message}`);
  }
}

/**
 * Load multiple config files and collect non-null results.
 *
 * @param paths - Array of config file paths
 * @returns Array of loaded configurations (skips missing files)
 */
async function loadConfigs(paths: string[]): Promise<ToolscriptConfig[]> {
  const configs: ToolscriptConfig[] = [];

  for (const path of paths) {
    const config = await loadSingleConfig(path);
    if (config !== null) {
      configs.push(config);
    }
  }

  return configs;
}

/**
 * Merge multiple configs.
 * Later configs override earlier ones at the server level.
 *
 * @param configs - Array of configurations to merge
 * @returns Merged configuration
 */
function mergeConfigs(configs: ToolscriptConfig[]): ToolscriptConfig {
  const merged: ToolscriptConfig = { mcpServers: {} };

  for (const config of configs) {
    // Merge mcpServers object
    // Later server definitions completely replace earlier ones (no deep merge)
    Object.assign(merged.mcpServers, config.mcpServers);
  }

  return merged;
}

/**
 * Load and merge configuration from multiple files.
 *
 * @param configPaths - Single path, comma-separated paths, or array of paths (defaults to ~/.toolscript.json,.toolscript.json)
 * @returns Merged configuration, or null if no configs exist
 * @throws Error if configuration is invalid
 */
export async function loadConfig(
  configPaths: string | string[] = DEFAULT_CONFIG_PATHS,
): Promise<ToolscriptConfig | null> {
  const paths = parseConfigPaths(configPaths);
  const configs = await loadConfigs(paths);

  if (configs.length === 0) {
    // No config files found - return null (consistent with current behavior)
    return null;
  }

  return mergeConfigs(configs);
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
