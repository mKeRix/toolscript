/**
 * Deno sandbox configuration for toolscript execution.
 */

import { getLogger } from "../utils/logger.ts";

const logger = getLogger("sandbox");

/**
 * Sandbox execution options
 */
export interface SandboxOptions {
  gatewayUrl: string;
  code: string;
  isFile?: boolean;
}

/**
 * Create temporary import map for clean imports
 */
async function createImportMap(gatewayUrl: string): Promise<string> {
  const timestamp = Date.now();
  const importMap = {
    imports: {
      "toolscript": `${gatewayUrl}/runtime/tools.ts?_t=${timestamp}`,
    },
  };

  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  await Deno.writeTextFile(tempFile, JSON.stringify(importMap, null, 2));
  logger.debug(`Created import map at ${tempFile}`);
  return tempFile;
}

/**
 * Execute code in a sandboxed Deno subprocess
 */
export async function executeSandboxed(options: SandboxOptions): Promise<{
  stdout: string;
  stderr: string;
  success: boolean;
}> {
  const { gatewayUrl, code, isFile } = options;

  // Create import map
  const importMapPath = await createImportMap(gatewayUrl);

  try {
    // Prepare code for execution
    let codeFile: string;
    let cleanupCodeFile = false;

    if (isFile) {
      // Code is a file path
      codeFile = code;
    } else {
      // Code is inline, write to temp file
      codeFile = await Deno.makeTempFile({ suffix: ".ts" });
      await Deno.writeTextFile(codeFile, code);
      cleanupCodeFile = true;
    }

    // Extract hostname and port from gateway URL for permissions
    const gatewayUrlObj = new URL(gatewayUrl);
    const gatewayHost = gatewayUrlObj.hostname;
    const gatewayPort = gatewayUrlObj.port;

    // Build Deno command with sandbox permissions
    const denoCmd = new Deno.Command("deno", {
      args: [
        "run",
        "--quiet", // Suppress informational output
        "--check", // Type-check before running
        `--allow-net=${gatewayHost}:${gatewayPort}`, // Only gateway access
        `--allow-import=${gatewayHost}:${gatewayPort}`, // Allow importing from gateway
        "--allow-env=TOOLSCRIPT_GATEWAY_URL", // Allow reading gateway URL
        `--import-map=${importMapPath}`,
        "--no-prompt",
        codeFile,
      ],
      clearEnv: true,
      env: {
        TOOLSCRIPT_GATEWAY_URL: gatewayUrl,
        DENO_NO_UPDATE_CHECK: "1", // Disable update check
      },
      stdout: "piped",
      stderr: "piped",
    });

    logger.debug(`Executing toolscript with gateway at ${gatewayUrl}`);
    const process = denoCmd.spawn();
    const output = await process.output();

    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    const success = output.success;

    // Cleanup
    if (cleanupCodeFile) {
      await Deno.remove(codeFile);
    }

    return { stdout, stderr, success };
  } finally {
    // Always cleanup import map
    await Deno.remove(importMapPath);
  }
}
