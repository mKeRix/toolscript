/**
 * HTTP MCP gateway server.
 */

import { Hono } from "hono";
import type { ToolscriptConfig } from "../config/types.ts";
import { ServerAggregator } from "./aggregator.ts";
import { generateToolsModule, TypeCache } from "../types/generator.ts";
import { getLogger } from "../utils/logger.ts";
import { SearchEngine } from "../search/mod.ts";
import type { SearchConfig, ToolMetadata } from "../search/mod.ts";

const logger = getLogger("gateway");

/**
 * Gateway server options
 */
export interface GatewayOptions {
  port?: number;
  hostname?: string;
  searchConfig?: Partial<SearchConfig>;
}

/**
 * HTTP MCP gateway server
 */
export class GatewayServer {
  private aggregator: ServerAggregator;
  private typeCache: TypeCache;
  private searchEngine: SearchEngine | null = null;
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

    // Initialize search engine
    await this.initializeSearchEngine(config, options.searchConfig);

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
          logger.info(`To access the gateway, run: export TOOLSCRIPT_GATEWAY_URL=${gatewayUrl}`);
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
    if (this.searchEngine) {
      await this.searchEngine.dispose();
    }
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
      return c.json({
        status: "ok",
        search: {
          ready: this.searchEngine?.isInitialized() ?? false,
          semantic: this.searchEngine?.isSemanticAvailable() ?? false,
        },
      });
    });

    // List servers
    app.get("/servers", (c) => {
      const servers = this.aggregator.getServers();
      return c.json(servers);
    });

    // List tools
    app.get("/tools", (c) => {
      const filter = c.req.query("filter");
      const tools = filter
        ? this.aggregator.getToolsByFilter(filter)
        : this.aggregator.getAllTools();
      return c.json(tools);
    });

    // Search tools
    app.get("/search", async (c) => {
      if (!this.searchEngine || !this.searchEngine.isInitialized()) {
        return c.json({ error: "Search engine not initialized" }, 503);
      }

      const query = c.req.query("q");
      if (!query) {
        return c.json({ error: "Query parameter 'q' is required" }, 400);
      }

      const limit = parseInt(c.req.query("limit") || "3", 10);
      const threshold = parseFloat(c.req.query("threshold") || "0.35");

      const results = await this.searchEngine.search(query, limit, threshold);
      return c.json(results);
    });

    // Search stats
    app.get("/search/stats", (c) => {
      if (!this.searchEngine) {
        return c.json({ error: "Search engine not initialized" }, 503);
      }

      const stats = this.searchEngine.getStats();
      return c.json(stats);
    });

    // Runtime tools module
    app.get("/runtime/tools.ts", async (c) => {
      // Filter parameter (comma-separated tool identifiers)
      const filter = c.req.query("filter");

      if (filter) {
        // Generate filtered module
        const tools = this.aggregator.getToolsByFilter(filter);
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

  /**
   * Initialize the search engine with tools from all connected servers
   */
  private async initializeSearchEngine(
    config: ToolscriptConfig,
    searchConfig?: Partial<SearchConfig>,
  ): Promise<void> {
    try {
      // Get server names for config hash
      const serverNames = Object.keys(config.mcpServers);

      // Create and initialize search engine
      // SearchEngine constructor merges config with defaults
      this.searchEngine = new SearchEngine(searchConfig || {});
      await this.searchEngine.initialize(serverNames);

      // Convert aggregator tools to search ToolMetadata format
      const aggregatorTools = this.aggregator.getAllTools();
      const searchTools: ToolMetadata[] = aggregatorTools.map((t) => ({
        serverName: t.serverName,
        toolName: t.toolName,
        toolId: t.qualifiedName,
        description: t.description || "",
        inputSchema: t.inputSchema,
      }));

      // Index all tools
      await this.searchEngine.indexTools(searchTools);

      const stats = this.searchEngine.getStats();
      logger.info(
        `Search engine initialized: ${stats.toolsIndexed} tools indexed, semantic=${stats.semanticAvailable}`,
      );
    } catch (error) {
      logger.error(`Failed to initialize search engine: ${error}`);
      // Search is optional - gateway continues without it
    }
  }

  /**
   * Symbol.asyncDispose for explicit resource management (using pattern)
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.stop();
  }
}
