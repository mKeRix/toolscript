/**
 * Gateway management commands.
 */

import { Command, EnumType } from "@cliffy/command";
import { dedent } from "@std/text/unstable-dedent";
import { emptyConfig, loadConfig } from "../../config/loader.ts";
import { GatewayServer } from "../../gateway/server.ts";
import { configureLogger } from "../../utils/logger.ts";
import { getDefaultDataDir } from "../../utils/paths.ts";

/**
 * Gateway start command
 */
export const gatewayStartCommand = new Command()
  .description("Start the MCP gateway server")
  .type("device", new EnumType(["auto", "cpu", "gpu"]))
  .option("-p, --port <port:number>", "Port to listen on (default: random)", { default: 0 })
  .option("-H, --hostname <hostname:string>", "Hostname to bind to", { default: "localhost" })
  .option("-c, --config <path:string>", "Path to config file", {
    default: "./.toolscript.json",
  })
  .option("--search-model <name:string>", "Embedding model for search")
  .option("--search-device <device:device>", "Device for search")
  .option("--search-alpha <value:number>", "Search alpha (semantic vs fuzzy weight)")
  .option("--search-no-cache", "Disable embedding cache")
  .option("--data-dir <path:string>", "Data directory for cache storage", {
    default: getDefaultDataDir(),
  })
  .env("TOOLSCRIPT_SEARCH_MODEL=<name:string>", "Embedding model", { prefix: "TOOLSCRIPT_" })
  .env("TOOLSCRIPT_SEARCH_DEVICE=<device:device>", "Search device", { prefix: "TOOLSCRIPT_" })
  .env("TOOLSCRIPT_SEARCH_ALPHA=<value:number>", "Search alpha weight", { prefix: "TOOLSCRIPT_" })
  .env("TOOLSCRIPT_SEARCH_NO_CACHE=<flag:boolean>", "Disable cache", { prefix: "TOOLSCRIPT_" })
  .env("TOOLSCRIPT_DATA_DIR=<path:string>", "Data directory", { prefix: "TOOLSCRIPT_" })
  .action(async (options) => {
    configureLogger("info");

    // Load configuration (or use empty config if file doesn't exist)
    const config = await loadConfig(options.config) || emptyConfig();

    // Build search config from CLI options
    const searchConfig: Record<string, unknown> = {
      dataDir: options.dataDir,
    };
    if (options.searchModel) searchConfig.model = options.searchModel;
    if (options.searchDevice) searchConfig.device = options.searchDevice;
    if (options.searchAlpha !== undefined) searchConfig.alpha = options.searchAlpha;
    if (options.searchNoCache) searchConfig.enableCache = false;

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
      searchConfig,
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
