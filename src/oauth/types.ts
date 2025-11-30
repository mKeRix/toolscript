/**
 * OAuth2 type definitions for toolscript
 */

import type { OAuthClientInformation, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

/**
 * Combined OAuth data structure stored per server
 * Includes both client registration info and tokens
 */
export interface OAuthData {
  /** Client registration information (from dynamic registration) */
  clientInformation?: OAuthClientInformation;
  /** OAuth tokens (access, refresh, etc.) */
  tokens?: OAuthTokens;
}

/**
 * OAuth data storage interface
 * Abstracts over different storage backends (file, keychain)
 */
export interface OAuthStorage {
  /**
   * Get OAuth data for a server
   * @param serverName - Server identifier
   * @returns OAuth data or undefined if not found
   */
  getOAuthData(serverName: string): Promise<OAuthData | undefined>;

  /**
   * Save OAuth data for a server
   * @param serverName - Server identifier
   * @param data - OAuth data to save
   */
  saveOAuthData(serverName: string, data: OAuthData): Promise<void>;

  /**
   * Delete OAuth data for a server
   * @param serverName - Server identifier
   */
  deleteOAuthData(serverName: string): Promise<void>;
}
