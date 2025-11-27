/**
 * Path utilities for toolscript data directories
 */

/**
 * Get the default toolscript data directory.
 * This is the single source of truth for the data directory path.
 *
 * Default: ~/.toolscript
 */
export function getDefaultDataDir(): string {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
  return `${home}/.toolscript`;
}
