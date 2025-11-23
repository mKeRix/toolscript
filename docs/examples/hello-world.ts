/**
 * Hello World Example
 *
 * This example demonstrates basic toolscript usage with the filesystem MCP server.
 */

import { tools } from "toolscript";

// List files in /tmp
const files = await tools.filesystem.listDirectory({
  path: "/tmp",
});

console.log("Files in /tmp:");
for (const file of files) {
  console.log(`  - ${file.name} (${file.type})`);
}
