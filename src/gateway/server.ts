/**
 * HTTP MCP gateway server.
 */

import { Hono } from "hono";
import type { ToolscriptConfig } from "../config/types.ts";
import { ServerAggregator } from "./aggregator.ts";
import { generateToolsModule, TypeCache } from "../types/generator.ts";
import { getLogger } from "../utils/logger.ts";

const logger = getLogger("gateway");

/**
 * Gateway server options
 */
export interface GatewayOptions {
  port?: number;
  hostname?: string;
}

/**
 * HTTP MCP gateway server
 */
export class GatewayServer {
  private aggregator: ServerAggregator;
  private typeCache: TypeCache;
  private server: Deno.HttpServer | null = null;
  private port = 0;
  private hostname = "localhost";

  constructor() {
    this.aggregator = new ServerAggregator();
    this.typeCache = new TypeCache();
  }

  /**
   * Start the gateway server
   */
  async start(config: ToolscriptConfig, options: GatewayOptions = {}): Promise<void> {
    this.port = options.port || 0; // 0 = random port
    this.hostname = options.hostname || "localhost";

    logger.info(`Starting gateway server on ${this.hostname}:${this.port || "random"}`);

    // Initialize aggregator and connect to servers
    await this.aggregator.initialize(config);

    // Generate initial types
    await this.regenerateTypes();

    // Create Hono app with routes
    const app = this.createApp();

    // Start HTTP server
    this.server = Deno.serve(
      {
        port: this.port,
        hostname: this.hostname,
        onListen: ({ hostname, port }) => {
          this.port = port;
          // Format hostname for URL (IPv6 needs brackets)
          const urlHostname = hostname.includes(":") ? `[${hostname}]` : hostname;
          const gatewayUrl = `http://${urlHostname}:${port}`;
          logger.info(`Gateway server listening on ${gatewayUrl}`);
          console.log(`To access the gateway, run: export TOOLSCRIPT_GATEWAY_URL=${gatewayUrl}`);
        },
      },
      app.fetch,
    );

    await this.server.finished;
  }

  /**
   * Stop the gateway server
   */
  async stop(): Promise<void> {
    logger.info("Stopping gateway server");
    await this.aggregator.shutdown();
    if (this.server) {
      await this.server.shutdown();
      this.server = null;
    }
  }

  /**
   * Get the server port (available after start)
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Create Hono app with routes
   */
  private createApp(): Hono {
    const app = new Hono();

    // Health check
    app.get("/health", (c) => {
      return c.json({ status: "ok" });
    });

    // List servers
    app.get("/servers", (c) => {
      const servers = this.aggregator.getServers();
      return c.json(servers);
    });

    // List tools
    app.get("/tools", (c) => {
      const serverFilter = c.req.query("server");
      const tools = this.aggregator.getFilteredTools(serverFilter);
      return c.json(tools);
    });

    // Runtime tools module
    app.get("/runtime/tools.ts", async (c) => {
      const serverFilter = c.req.query("server");
      const toolFilter = c.req.query("tool");

      if (serverFilter || toolFilter) {
        // Generate filtered module on-demand
        const tools = this.aggregator.getFilteredTools(serverFilter, toolFilter);
        const gatewayUrl = `http://${this.hostname}:${this.port}`;
        const module = await generateToolsModule(tools, gatewayUrl);
        return c.text(module, 200, { "Content-Type": "application/typescript" });
      }

      // Return cached full module
      const cached = this.typeCache.get();
      if (cached) {
        return c.text(cached, 200, { "Content-Type": "application/typescript" });
      }

      return c.text("// No tools available\nexport const tools = {};\n", 200, {
        "Content-Type": "application/typescript",
      });
    });

    // Tool execution
    app.post("/tools/:toolName", async (c) => {
      const toolName = c.req.param("toolName");
      const body = await c.req.json();
      const result = await this.aggregator.callTool(toolName, body as Record<string, unknown>);
      return c.json(result);
    });

    // Error handling
    app.onError((err, c) => {
      logger.error(`Request error: ${err}`);
      return c.json({ error: err.message }, 500);
    });

    return app;
  }

  /**
   * Regenerate type cache
   */
  private async regenerateTypes(): Promise<void> {
    const tools = this.aggregator.getAllTools();
    const gatewayUrl = `http://${this.hostname}:${this.port}`;
    const module = await generateToolsModule(tools, gatewayUrl);
    this.typeCache.set(module);
    logger.info(`Generated types for ${tools.length} tools`);
  }
}
