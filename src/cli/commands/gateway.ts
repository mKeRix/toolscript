/**
 * Gateway management commands.
 */

import { Command } from "@cliffy/command";
import { dedent } from "@std/text/unstable-dedent";
import { emptyConfig, loadConfig } from "../../config/loader.ts";
import { GatewayServer } from "../../gateway/server.ts";
import { configureLogger } from "../../utils/logger.ts";

/**
 * Gateway start command
 */
export const gatewayStartCommand = new Command()
  .description("Start the MCP gateway server")
  .option("-p, --port <port:number>", "Port to listen on (default: random)", { default: 0 })
  .option("-H, --hostname <hostname:string>", "Hostname to bind to", { default: "localhost" })
  .option("-c, --config <path:string>", "Path to config file", {
    default: "./.toolscript.json",
  })
  .action(async (options) => {
    configureLogger("info");

    // Load configuration (or use empty config if file doesn't exist)
    const config = await loadConfig(options.config) || emptyConfig();

    // Start gateway
    const gateway = new GatewayServer();

    // Handle shutdown signals
    const shutdown = async () => {
      await gateway.stop();
      Deno.exit(0);
    };

    Deno.addSignalListener("SIGTERM", shutdown);
    Deno.addSignalListener("SIGINT", shutdown);

    // Start server (blocks until shutdown)
    await gateway.start(config, {
      port: options.port,
      hostname: options.hostname,
    });
  });

/**
 * Gateway status command
 */
export const gatewayStatusCommand = new Command()
  .description("Check gateway server status")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options) => {
    try {
      const response = await fetch(`${options.gatewayUrl}/health`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        console.log(dedent`
          Status: running
          URL: ${options.gatewayUrl}
          Health: ${JSON.stringify(data)}
        `);
      } else {
        console.log(`Status: unhealthy (HTTP ${response.status})`);
        Deno.exit(1);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`Status: not running (${error.message})`);
      } else {
        console.log(`Status: not running`);
      }
      Deno.exit(1);
    }
  });

/**
 * Gateway command group
 */
export const gatewayCommand = new Command()
  .description("Manage the MCP gateway server")
  .command("start", gatewayStartCommand)
  .command("status", gatewayStatusCommand);
