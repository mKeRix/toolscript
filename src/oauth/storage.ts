/**
 * OAuth data storage implementation
 * Stores OAuth client registration and tokens securely in the filesystem
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { getLogger } from "@logtape/logtape";
import { getDefaultDataDir } from "../utils/paths.ts";
import type { OAuthData, OAuthStorage } from "./types.ts";

const logger = getLogger(["toolscript", "oauth", "storage"]);

/**
 * Get the OAuth storage directory path
 * Defaults to ~/.toolscript/oauth/
 */
function getOAuthStorageDir(): string {
  return join(getDefaultDataDir(), "oauth");
}

/**
 * File-based OAuth storage implementation
 * Stores OAuth data in ~/.toolscript/oauth/<server-name>.json with 0600 permissions
 *
 * Security:
 * - Files are created with 0600 permissions (read/write owner only)
 * - Directory is created with 0700 permissions (owner only)
 * - No encryption (relies on filesystem permissions)
 */
export class FileOAuthStorage implements OAuthStorage {
  private readonly storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || getOAuthStorageDir();
  }

  /**
   * Get the file path for a server's OAuth data
   */
  private getFilePath(serverName: string): string {
    // Sanitize server name to prevent directory traversal
    const sanitized = serverName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.storageDir, `${sanitized}.json`);
  }

  /**
   * Ensure storage directory exists with proper permissions
   */
  private async ensureStorageDir(): Promise<void> {
    await ensureDir(this.storageDir);

    // Set directory permissions to 0700 (owner only)
    if (Deno.build.os !== "windows") {
      await Deno.chmod(this.storageDir, 0o700);
    }
  }

  async getOAuthData(serverName: string): Promise<OAuthData | undefined> {
    const filePath = this.getFilePath(serverName);

    try {
      const data = await Deno.readTextFile(filePath);
      const parsed = JSON.parse(data) as OAuthData;

      logger.debug`Loaded OAuth data for ${serverName}`;
      return parsed;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        logger.debug`No OAuth data found for ${serverName}`;
        return undefined;
      }

      logger.error`Failed to read OAuth data for ${serverName}: ${error}`;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read OAuth data: ${message}`);
    }
  }

  async saveOAuthData(serverName: string, data: OAuthData): Promise<void> {
    await this.ensureStorageDir();

    const filePath = this.getFilePath(serverName);
    const json = JSON.stringify(data, null, 2);

    try {
      // Write file with secure permissions
      await Deno.writeTextFile(filePath, json);

      // Set file permissions to 0600 (read/write owner only) on Unix-like systems
      if (Deno.build.os !== "windows") {
        await Deno.chmod(filePath, 0o600);
      }

      logger.debug`Saved OAuth data for ${serverName}`;
    } catch (error) {
      logger.error`Failed to save OAuth data for ${serverName}: ${error}`;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save OAuth data: ${message}`);
    }
  }

  async deleteOAuthData(serverName: string): Promise<void> {
    const filePath = this.getFilePath(serverName);

    try {
      await Deno.remove(filePath);
      logger.info`Deleted OAuth data for ${serverName}`;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        logger.debug`No OAuth data to delete for ${serverName}`;
        return;
      }

      logger.error`Failed to delete OAuth data for ${serverName}: ${error}`;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete OAuth data: ${message}`);
    }
  }
}

/**
 * Create a new OAuth storage instance
 * Currently uses file-based storage
 */
export function createOAuthStorage(): OAuthStorage {
  return new FileOAuthStorage();
}
