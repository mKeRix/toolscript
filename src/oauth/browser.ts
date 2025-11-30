/**
 * Browser opening utility for OAuth authorization flows
 */

import { getLogger } from "@logtape/logtape";

const logger = getLogger(["toolscript", "oauth", "browser"]);

/**
 * Attempt to open a URL in the user's default browser
 *
 * @param url - The URL to open
 * @returns true if browser was opened successfully, false otherwise
 */
export async function openBrowser(url: string | URL): Promise<boolean> {
  const urlString = url.toString();
  logger.debug`Attempting to open browser for URL: ${urlString}`;

  try {
    let command: string[];

    // Determine the appropriate command based on OS
    if (Deno.build.os === "darwin") {
      command = ["open", urlString];
    } else if (Deno.build.os === "windows") {
      command = ["cmd", "/c", "start", urlString];
    } else {
      // Linux and other Unix-like systems
      command = ["xdg-open", urlString];
    }

    // Run the command
    const process = new Deno.Command(command[0], {
      args: command.slice(1),
      stdout: "null",
      stderr: "null",
    });

    const { code } = await process.output();

    if (code === 0) {
      logger.info`Successfully opened browser`;
      return true;
    } else {
      logger.warn`Browser command exited with code ${code}`;
      return false;
    }
  } catch (error) {
    logger.warn`Failed to open browser: ${error}`;
    return false;
  }
}
