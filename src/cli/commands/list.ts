/**
 * List commands for servers and tools.
 */

import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";

/**
 * List servers command
 */
export const listServersCommand = new Command()
  .description("List connected MCP servers (requires running gateway)")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options) => {
    const gatewayUrl = options.gatewayUrl;

    try {
      const response = await fetch(`${gatewayUrl}/servers`);
      if (!response.ok) {
        console.error(`Failed to fetch servers: ${response.statusText}`);
        Deno.exit(1);
      }

      const servers = await response.json() as Array<{
        name: string;
        title?: string;
        instructions?: string;
      }>;

      if (servers.length === 0) {
        console.log("No servers connected");
        return;
      }

      const table = new Table()
        .header(["Server", "Title", "Instructions"])
        .body(
          servers.map((s) => [
            s.name,
            s.title || s.name,
            s.instructions || "",
          ]),
        );

      table.render();
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(1);
    }
  });

/**
 * List tools command
 */
export const listToolsCommand = new Command()
  .description("List tools from a server (requires running gateway)")
  .arguments("<server:string>")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options, server: string) => {
    const gatewayUrl = options.gatewayUrl;

    try {
      const response = await fetch(`${gatewayUrl}/tools`);
      if (!response.ok) {
        console.error(`Failed to fetch tools: ${response.statusText}`);
        Deno.exit(1);
      }

      const tools = await response.json();
      const serverTools = tools.filter((t: { serverName: string }) => t.serverName === server);

      if (serverTools.length === 0) {
        console.log(`No tools found for server: ${server}`);
        return;
      }

      const table = new Table()
        .header(["Tool", "Description"])
        .body(
          serverTools.map((t: { toolName: string; description?: string }) => [
            t.toolName,
            t.description || "",
          ]),
        );

      table.render();
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(1);
    }
  });
