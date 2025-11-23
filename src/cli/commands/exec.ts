/**
 * Toolscript execution command.
 */

import { Command } from "@cliffy/command";
import { executeSandboxed } from "../../execution/sandbox.ts";
import { configureLogger } from "../../utils/logger.ts";

/**
 * Exec command
 */
export const execCommand = new Command()
  .description("Execute a toolscript")
  .arguments("<code-or-file:string>")
  .option("-f, --file", "Treat argument as file path instead of inline code")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options, codeOrFile: string) => {
    configureLogger("error"); // Minimal logging for exec

    const gatewayUrl = options.gatewayUrl;

    try {
      const result = await executeSandboxed({
        gatewayUrl,
        code: codeOrFile,
        isFile: options.file,
      });

      // Output stdout
      if (result.stdout) {
        console.log(result.stdout);
      }

      // Output stderr to stderr
      if (result.stderr) {
        console.error(result.stderr);
      }

      // Exit with appropriate code
      if (!result.success) {
        Deno.exit(1);
      }
    } catch (error) {
      console.error(`Execution error: ${error}`);
      Deno.exit(1);
    }
  });
