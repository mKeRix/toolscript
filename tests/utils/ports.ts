/**
 * Utility for getting random free ports for testing.
 */

/**
 * Gets a random free port by creating and immediately closing a listener.
 * This is not 100% race-condition free, but works well for tests.
 */
export async function getRandomPort(): Promise<number> {
  // Create a listener on port 0 to get a random available port
  const listener = Deno.listen({ hostname: "localhost", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}
