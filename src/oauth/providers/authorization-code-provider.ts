/**
 * Persistent OAuth Authorization Code provider
 * Implements OAuthClientProvider with file-based token storage
 */

import { getLogger } from "@logtape/logtape";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthStorage } from "../types.ts";
import { randomBytes } from "node:crypto";

const logger = getLogger(["toolscript", "oauth", "authorization-code"]);

/**
 * Authorization Code OAuth provider with persistent storage
 */
export class AuthorizationCodeProvider implements OAuthClientProvider {
  private _codeVerifier?: string;
  private _state?: string;

  constructor(
    private readonly serverName: string,
    private readonly storage: OAuthStorage,
    public readonly redirectUrl: string | URL,
    private readonly onRedirect?: (url: URL) => void | Promise<void>,
  ) {}

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl.toString()],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: "Toolscript",
      client_uri: "https://github.com/mKeRix/toolscript",
      scope: "",
    };
  }

  state(): Promise<string> {
    if (!this._state) {
      this._state = randomBytes(32).toString("base64url");
    }
    return Promise.resolve(this._state);
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const data = await this.storage.getOAuthData(this.serverName);

    if (!data?.clientInformation) {
      logger.debug`No client information found for ${this.serverName}`;
      return undefined;
    }

    logger.debug`Loaded client information for ${this.serverName}`;

    return await OAuthClientInformationSchema.parseAsync(data.clientInformation);
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformation,
  ): Promise<void> {
    const existing = await this.storage.getOAuthData(this.serverName);

    await this.storage.saveOAuthData(this.serverName, {
      ...existing,
      clientInformation,
    });

    logger.info`Saved client registration for ${this.serverName}`;
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const data = await this.storage.getOAuthData(this.serverName);

    if (!data?.tokens) {
      logger.debug`No tokens found for ${this.serverName}`;
      return undefined;
    }

    logger.debug`Loaded tokens for ${this.serverName}`;

    return await OAuthTokensSchema.parseAsync(data.tokens);
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const existing = await this.storage.getOAuthData(this.serverName);

    await this.storage.saveOAuthData(this.serverName, {
      ...existing,
      tokens,
    });

    logger.debug`Saved tokens for ${this.serverName}`;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    logger.info`Redirecting to authorization URL for ${this.serverName}`;

    if (this.onRedirect) {
      await this.onRedirect(authorizationUrl);
    } else {
      logger.info`Authorization URL: ${authorizationUrl.toString()}`;
    }
  }

  saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
    logger.debug`Saved code verifier for ${this.serverName}`;
    return Promise.resolve();
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error(`No code verifier saved for ${this.serverName}`);
    }
    return this._codeVerifier;
  }
}
