/**
 * Get types command.
 */

import { Command } from "@cliffy/command";
import { fetchTypes, formatTypesOutput } from "../utils/types-output.ts";

/**
 * Get types command
 */
export const getTypesCommand = new Command()
  .description("Get TypeScript types for tools")
  .option("-f, --filter <filter:string>", "Filter tools (comma-separated: server1,server2__tool)")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options) => {
    try {
      const typesCode = await fetchTypes(options.gatewayUrl, options.filter);
      const output = formatTypesOutput(typesCode, {
        filter: options.filter,
      });
      console.log(output);
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(1);
    }
  });
