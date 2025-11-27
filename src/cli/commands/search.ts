/**
 * Search command - Find tools using semantic + fuzzy search
 */

import { Command, EnumType } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { dedent } from "@std/text/unstable-dedent";
import { fetchTypes, formatTypesOutput } from "../utils/types-output.ts";

/**
 * Search result from gateway
 */
interface SearchResultItem {
  tool: {
    serverName: string;
    toolName: string;
    toolId: string;
    description: string;
  };
  score: number;
  scoreBreakdown: {
    semantic: number;
    fuzzy: number;
    combined: number;
  };
  reason?: string;
}

/**
 * Format confidence score as percentage
 */
function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

/**
 * Build confidence table in Markdown format
 */
function buildConfidenceTable(results: SearchResultItem[]): string {
  const rows = results.map((r) => {
    return `| ${r.tool.toolId} | ${formatScore(r.score)} | ${r.reason || "match"} |`;
  });

  return dedent`
    | Tool | Confidence | Reason |
    |------|------------|--------|
    ${rows.join("\n")}
  `;
}

/**
 * Search command
 */
export const searchCommand = new Command()
  .description("Search for tools using semantic + fuzzy matching")
  .type("output-format", new EnumType(["table", "types"]))
  .arguments("<query:string>")
  .option("-g, --gateway-url <url:string>", "Gateway URL", {
    default: "http://localhost:3000",
  })
  .option("-l, --limit <n:number>", "Maximum number of results", { default: 3 })
  .option("-t, --threshold <score:number>", "Minimum confidence threshold", {
    default: 0.35,
  })
  .option("-o, --output <format:output-format>", "Output format", {
    default: "table",
  })
  .option("-m, --model <name:string>", "Embedding model name")
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .env("TOOLSCRIPT_SEARCH_LIMIT=<n:number>", "Default search limit", {
    prefix: "TOOLSCRIPT_SEARCH_",
  })
  .env("TOOLSCRIPT_SEARCH_THRESHOLD=<score:number>", "Default threshold", {
    prefix: "TOOLSCRIPT_SEARCH_",
  })
  .action(async (options, query: string) => {
    const gatewayUrl = options.gatewayUrl;
    const limit = options.limit;
    const threshold = options.threshold;
    const outputFormat = options.output;

    try {
      // Build search URL
      const searchParams = new URLSearchParams({
        q: query,
        limit: String(limit),
        threshold: String(threshold),
      });

      // Fetch search results
      const searchResponse = await fetch(
        `${gatewayUrl}/search?${searchParams}`,
      );

      if (!searchResponse.ok) {
        if (searchResponse.status === 503) {
          console.error(
            "Search engine not ready. Ensure the gateway is running with search enabled.",
          );
          Deno.exit(1);
        }
        console.error(`Search failed: ${searchResponse.statusText}`);
        Deno.exit(1);
      }

      const results: SearchResultItem[] = await searchResponse.json();

      if (results.length === 0) {
        console.log("No tools found matching your query.");
        Deno.exit(0);
      }

      if (outputFormat === "types") {
        // Types output format: confidence table + TypeScript code
        await outputTypesFormat(gatewayUrl, results);
      } else {
        // Table output format (default)
        outputTableFormat(results);
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error(
          `Cannot connect to gateway at ${gatewayUrl}. Is it running?`,
        );
      } else {
        console.error(`Error: ${error}`);
      }
      Deno.exit(1);
    }
  });

/**
 * Output results in table format
 */
function outputTableFormat(results: SearchResultItem[]): void {
  const table = new Table()
    .header(["Tool", "Confidence", "Description"])
    .body(
      results.map((r) => [
        r.tool.toolId,
        formatScore(r.score),
        r.tool.description?.substring(0, 50) +
          (r.tool.description?.length > 50 ? "..." : "") || "",
      ]),
    )
    .border(true)
    .padding(1);

  table.render();
}

/**
 * Output results in types format (confidence table + TypeScript code)
 */
async function outputTypesFormat(
  gatewayUrl: string,
  results: SearchResultItem[],
): Promise<void> {
  // Build tool filter from results
  const toolIds = results.map((r) => r.tool.toolId).join(",");

  // Fetch TypeScript types for matching tools
  const typesCode = await fetchTypes(gatewayUrl, toolIds);

  // Build confidence table
  const confidenceTable = buildConfidenceTable(results);

  // Format output with preamble and specific usage example
  const output = formatTypesOutput(typesCode, {
    preamble: dedent`
      ## Search Results

      ${confidenceTable}
    `,
    usageExample: {
      serverName: results[0].tool.serverName,
      toolName: results[0].tool.toolName,
    },
  });

  console.log(output);
}
