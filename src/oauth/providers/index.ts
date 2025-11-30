/**
 * OAuth provider factory
 * Creates appropriate OAuth provider based on configuration
 */

import { getLogger } from "@logtape/logtape";
import type { OAuthStorage } from "../types.ts";
import { AuthorizationCodeProvider } from "./authorization-code-provider.ts";

const logger = getLogger(["toolscript", "oauth", "factory"]);

/**
 * Create OAuth provider for authorization code flow
 *
 * @param serverName - Server identifier
 * @param storage - OAuth data storage implementation
 * @param redirectUrl - Callback URL for authorization code flow
 * @param onRedirect - Optional callback for handling authorization redirect
 * @returns Configured OAuth provider for authorization code flow
 */
export function createOAuthProvider(
  serverName: string,
  storage: OAuthStorage,
  redirectUrl: string | URL,
  onRedirect?: (url: URL) => void | Promise<void>,
) {
  logger.debug`Creating authorization_code OAuth provider for ${serverName}`;

  return new AuthorizationCodeProvider(
    serverName,
    storage,
    redirectUrl,
    onRedirect,
  );
}
