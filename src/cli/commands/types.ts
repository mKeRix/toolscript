/**
 * Get types command.
 */

import { Command } from "@cliffy/command";
import { dedent } from "@std/text/unstable-dedent";

/**
 * Get types command
 */
export const getTypesCommand = new Command()
  .description("Get TypeScript types for tools")
  .option("-f, --filter <filter:string>", "Filter tools (comma-separated: server1,server2__tool)")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options) => {
    const gatewayUrl = options.gatewayUrl;
    const filter = options.filter;

    try {
      let url = `${gatewayUrl}/runtime/tools.ts`;
      if (filter) {
        url += `?filter=${encodeURIComponent(filter)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch types: ${response.statusText}`);
        Deno.exit(1);
      }

      const types = await response.text();

      // Output as markdown code block
      const exampleServer = filter?.split(",")[0]?.split("__")[0] || "serverName";
      console.log(dedent`
        \`\`\`typescript
        ${types}
        \`\`\`

        Usage example:
        \`\`\`typescript
        import { tools } from "toolscript";

        // Call tools using the generated client
        const result = await tools.${exampleServer}.someMethod(params);
        \`\`\`
      `);
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(1);
    }
  });
