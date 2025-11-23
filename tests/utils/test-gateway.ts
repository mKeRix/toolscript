// deno-coverage-ignore-file
/**
 * Test utilities for managing gateway and MCP server processes in E2E tests.
 */

import { getRandomPort } from "./ports.ts";

export interface TestGatewayInstance extends AsyncDisposable {
  port: number;
  url: string;
  process: Deno.ChildProcess;
  configFile: string;
  httpServerProcess?: Deno.ChildProcess;
  sseServerProcess?: Deno.ChildProcess;
  cleanup: () => Promise<void>;
}

/**
 * Start a test gateway instance with an MCP server configured
 */
export async function startTestGateway(): Promise<TestGatewayInstance> {
  const port = await getRandomPort();
  const hostname = "localhost";

  // Start HTTP test server
  const httpPort = await getRandomPort();
  const httpCmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-env",
      "tests/fixtures/http-mcp-server.ts",
      `${httpPort}`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const httpServerProcess = httpCmd.spawn();

  // Start SSE test server
  const ssePort = await getRandomPort();
  const sseCmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-env",
      "tests/fixtures/sse-mcp-server.ts",
      `${ssePort}`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const sseServerProcess = sseCmd.spawn();

  // Wait for HTTP server to be ready (longer wait for first run when npm packages download)
  let httpReady = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`http://localhost:${httpPort}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 1 }),
        signal: AbortSignal.timeout(1000),
      });
      await response.text(); // Consume response
      // Server is ready if it responds (even with an error is fine, it means it's running)
      httpReady = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (!httpReady) {
    // Try to get stderr from the process
    const decoder = new TextDecoder();
    let stderr = "";
    try {
      const reader = httpServerProcess.stderr.getReader();
      const { value } = await reader.read();
      if (value) {
        stderr = decoder.decode(value);
      }
      reader.releaseLock();
    } catch {
      // Ignore read errors
    }

    // Cleanup if HTTP server failed
    try {
      httpServerProcess.kill("SIGTERM");
      sseServerProcess.kill("SIGTERM");
      await httpServerProcess.status;
      await sseServerProcess.status;
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`HTTP test server failed to start. Stderr: ${stderr}`);
  }

  // Wait for SSE server to be ready (longer wait for first run when npm packages download)
  let sseReady = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`http://localhost:${ssePort}/sse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: {}, id: 1 }),
        signal: AbortSignal.timeout(1000),
      });
      await response.text(); // Consume response
      // Server is ready if it responds (even with an error is fine, it means it's running)
      sseReady = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (!sseReady) {
    // Cleanup if SSE server failed
    try {
      httpServerProcess.kill("SIGTERM");
      sseServerProcess.kill("SIGTERM");
      await httpServerProcess.status;
      await sseServerProcess.status;
    } catch {
      // Ignore cleanup errors
    }
    throw new Error("SSE test server failed to start");
  }

  // Create a temporary config file for the gateway with all three transport types
  const tempConfigFile = await Deno.makeTempFile({ suffix: ".json" });
  const config = {
    mcpServers: {
      "stdio-test-server": {
        type: "stdio",
        command: "deno",
        args: [
          "run",
          "--allow-all",
          "tests/fixtures/stdio-mcp-server.ts",
        ],
      },
      "http-test-server": {
        type: "http",
        url: `http://localhost:${httpPort}`,
      },
      "sse-test-server": {
        type: "sse",
        url: `http://localhost:${ssePort}/sse`,
      },
    },
  };
  await Deno.writeTextFile(tempConfigFile, JSON.stringify(config, null, 2));

  // Start the gateway process
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-run",
      "--allow-sys",
      "src/cli/main.ts",
      "gateway",
      "start",
      "--port",
      `${port}`,
      "--hostname",
      hostname,
      "--config",
      tempConfigFile,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const process = cmd.spawn();

  // Wait for the gateway to be ready by polling the health endpoint
  const url = `http://${hostname}:${port}`;
  const maxAttempts = 50;
  let ready = false;

  // Start reading stdout/stderr in the background to prevent blocking
  const decoder = new TextDecoder();
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  // Track readers so we can cancel them during cleanup
  let stdoutReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let stderrReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  (async () => {
    stdoutReader = process.stdout.getReader();
    try {
      while (true) {
        const { done, value } = await stdoutReader.read();
        if (done) break;
        stdoutLines.push(decoder.decode(value));
      }
    } catch {
      // Stream closed or cancelled
    } finally {
      try {
        stdoutReader.releaseLock();
      } catch {
        // Already released
      }
    }
  })();

  (async () => {
    stderrReader = process.stderr.getReader();
    try {
      while (true) {
        const { done, value } = await stderrReader.read();
        if (done) break;
        stderrLines.push(decoder.decode(value));
      }
    } catch {
      // Stream closed or cancelled
    } finally {
      try {
        stderrReader.releaseLock();
      } catch {
        // Already released
      }
    }
  })();

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        // Consume the response body to prevent resource leak
        await response.text();
        ready = true;
        break;
      }
      // Consume response body even on non-ok response
      await response.text();
    } catch {
      // Gateway not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (!ready) {
    // Collect any output before failing
    const stdout = stdoutLines.join("");
    const stderr = stderrLines.join("");

    // Kill the process and cleanup
    try {
      process.kill("SIGTERM");
      await process.status;
    } catch {
      // Process might have already exited
    }
    await Deno.remove(tempConfigFile);

    const errorMsg =
      `Gateway failed to start within timeout.\nStdout: ${stdout}\nStderr: ${stderr}`;
    throw new Error(errorMsg);
  }

  // Cleanup function
  const cleanup = async () => {
    // Cancel stream readers before killing process
    if (stdoutReader) {
      try {
        await stdoutReader.cancel();
      } catch {
        // Already cancelled or closed
      }
    }
    if (stderrReader) {
      try {
        await stderrReader.cancel();
      } catch {
        // Already cancelled or closed
      }
    }

    try {
      process.kill("SIGTERM");
      // Wait for process to exit
      await process.status;
    } catch {
      // Process might have already exited
    }

    // Clean up HTTP server
    if (httpServerProcess) {
      try {
        // Close streams before killing to prevent leak
        httpServerProcess.stdout.cancel();
        httpServerProcess.stderr.cancel();
      } catch {
        // Already closed
      }
      try {
        httpServerProcess.kill("SIGTERM");
        await httpServerProcess.status;
      } catch {
        // Process might have already exited
      }
    }

    // Clean up SSE server
    if (sseServerProcess) {
      try {
        // Close streams before killing to prevent leak
        sseServerProcess.stdout.cancel();
        sseServerProcess.stderr.cancel();
      } catch {
        // Already closed
      }
      try {
        sseServerProcess.kill("SIGTERM");
        await sseServerProcess.status;
      } catch {
        // Process might have already exited
      }
    }

    // Clean up temp config file
    try {
      await Deno.remove(tempConfigFile);
    } catch {
      // File might already be deleted
    }
  };

  return {
    port,
    url,
    process,
    configFile: tempConfigFile,
    httpServerProcess,
    sseServerProcess,
    cleanup,
    [Symbol.asyncDispose]: cleanup,
  };
}
