/**
 * Logging utilities using logtape.
 */

import * as logtape from "@logtape/logtape";

/**
 * Configure the global logger.
 */
export function configureLogger(level: logtape.LogLevel = "info"): void {
  logtape.configure({
    sinks: {
      console: logtape.getConsoleSink(),
    },
    filters: {},
    loggers: [
      {
        category: "toolscript",
        lowestLevel: level,
        sinks: ["console"],
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning", // Silence info messages from LogTape's meta logger
        sinks: ["console"],
      },
    ],
  });
}

/**
 * Get a logger for a specific category.
 *
 * @param category - The logger category (e.g., "gateway", "cli", "execution")
 * @returns A logger instance
 */
export function getLogger(category: string): logtape.Logger {
  return logtape.getLogger(["toolscript", category]);
}
