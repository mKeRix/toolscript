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
  .arguments("<server:string> [tool:string]")
  .option("-g, --gateway-url <url:string>", "Gateway URL", { default: "http://localhost:3000" })
  .env("TOOLSCRIPT_GATEWAY_URL=<url:string>", "Gateway URL", { prefix: "TOOLSCRIPT_" })
  .action(async (options, server: string, tool?: string) => {
    const gatewayUrl = options.gatewayUrl;

    try {
      const params = new URLSearchParams({ server });
      if (tool) {
        params.append("tool", tool);
      }

      const response = await fetch(`${gatewayUrl}/runtime/tools.ts?${params}`);
      if (!response.ok) {
        console.error(`Failed to fetch types: ${response.statusText}`);
        Deno.exit(1);
      }

      const types = await response.text();

      // Output as markdown code block
      console.log(dedent`
        \`\`\`typescript
        ${types}
        \`\`\`

        Usage example:
        \`\`\`typescript
        import { tools } from "toolscript";

        // Call tools using the generated client
        const result = await tools.${server}.someMethod(params);
        \`\`\`
      `);
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(1);
    }
  });
