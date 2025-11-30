/**
 * OAuth callback server for handling authorization code flow
 */

import { getLogger } from "@logtape/logtape";

const logger = getLogger(["toolscript", "oauth", "callback-server"]);

/**
 * Result from the OAuth callback
 */
export interface CallbackResult {
  code?: string;
  error?: string;
}

/**
 * OAuth callback server configuration
 */
export interface CallbackServerConfig {
  onCallback: (result: CallbackResult) => void;
}

/**
 * OAuth callback server info with automatic cleanup
 */
export class CallbackServerInfo implements AsyncDisposable {
  constructor(
    public readonly port: number,
    private readonly cleanupFn: () => Promise<void>,
  ) {}

  /**
   * Manual cleanup
   */
  async cleanup(): Promise<void> {
    await this.cleanupFn();
  }

  /**
   * Automatic cleanup when using `await using` syntax
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup();
  }
}

/**
 * Start OAuth callback server on a random available port
 *
 * @param config - Server configuration
 * @returns Server info with port and cleanup function
 */
export async function startCallbackServer(
  config: CallbackServerConfig,
): Promise<CallbackServerInfo> {
  const { onCallback } = config;

  const abortController = new AbortController();
  const serverReady = Promise.withResolvers<number>();

  const callbackServer = Deno.serve(
    {
      port: 0, // Use random available port
      hostname: "localhost",
      signal: abortController.signal,
      onListen: (addr) => {
        const port = (addr as Deno.NetAddr).port;
        logger.debug`Callback server listening on port ${port}`;
        serverReady.resolve(port);
      },
    },
    (req) => {
      const url = new URL(req.url);

      if (url.pathname === "/oauth/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          logger.error`OAuth error: ${error}`;
          onCallback({ error });

          return new Response(
            "<html><body><h1>Authentication Failed</h1><p>You can close this window.</p></body></html>",
            { headers: { "content-type": "text/html" } },
          );
        }

        if (!code) {
          return new Response(
            "<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>",
            { status: 400, headers: { "content-type": "text/html" } },
          );
        }

        // Success - invoke callback with the authorization code
        onCallback({ code });

        return new Response(
          "<html><body><h1>Authentication Successful!</h1><p>You can close this window and return to the terminal.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>",
          { headers: { "content-type": "text/html" } },
        );
      }

      return new Response("Not Found", { status: 404 });
    },
  );

  // Wait for callback server to be ready and get the assigned port
  const port = await serverReady.promise;
  logger.debug`Callback server is ready on port ${port}`;

  // Return server info with cleanup function
  return new CallbackServerInfo(port, async () => {
    abortController.abort();
    await callbackServer.finished;
  });
}
