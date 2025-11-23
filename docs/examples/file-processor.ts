/**
 * File Processor Example
 *
 * Read a file, process its contents, and write the result.
 */

import { tools } from "toolscript";

// Configuration
const inputPath = "/tmp/input.txt";
const outputPath = "/tmp/output.txt";

try {
  // Read input file
  console.log(`Reading ${inputPath}...`);
  const content = await tools.filesystem.readFile({
    path: inputPath,
  });

  // Process content (convert to uppercase)
  const processed = content.toUpperCase();

  // Write output file
  console.log(`Writing to ${outputPath}...`);
  await tools.filesystem.writeFile({
    path: outputPath,
    content: processed,
  });

  console.log("✓ Processing complete");
} catch (error) {
  console.error(`✗ Error: ${error.message}`);
  Deno.exit(1);
}
