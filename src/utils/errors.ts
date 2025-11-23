/**
 * Custom error types for toolscript.
 */

/**
 * Base error class for toolscript errors
 */
export class ToolscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolscriptError";
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends ToolscriptError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Gateway-related errors
 */
export class GatewayError extends ToolscriptError {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}

/**
 * Execution-related errors
 */
export class ExecutionError extends ToolscriptError {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Type generation errors
 */
export class TypeGenerationError extends ToolscriptError {
  constructor(message: string) {
    super(message);
    this.name = "TypeGenerationError";
  }
}
