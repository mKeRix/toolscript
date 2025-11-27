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
      "--unstable-webgpu", // WebGPU support for transformers.js
      "--allow-net", // Network access for MCP servers and model download
      "--allow-read", // Read config files and model cache
      "--allow-write", // Write model cache and temp files
      "--allow-env", // Environment variables
      "--allow-run", // Run MCP server processes
      "--allow-sys", // System info
      "--allow-ffi", // FFI for ONNX Runtime (transformers.js)
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

  // Wait for gateway and search engine to be ready (longer timeout for model download on first run)
  const healthMaxAttempts = 100;
  for (let i = 0; i < healthMaxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const health = await response.json();
        // Check if both gateway and search are ready
        if (health.status === "ok" && health.search?.ready) {
          ready = true;
          break;
        }
      }
    } catch {
      // Gateway not ready yet, wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
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
    console.log("[Test Gateway] Starting cleanup...");

    // Cancel stream readers before killing process
    if (stdoutReader) {
      try {
        await stdoutReader.cancel();
        console.log("[Test Gateway] Cancelled stdout reader");
      } catch {
        // Already cancelled or closed
      }
    }
    if (stderrReader) {
      try {
        await stderrReader.cancel();
        console.log("[Test Gateway] Cancelled stderr reader");
      } catch {
        // Already cancelled or closed
      }
    }

    try {
      console.log("[Test Gateway] Killing gateway process...");
      process.kill("SIGTERM");
      // Wait for process to exit with timeout
      const statusPromise = process.status;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gateway shutdown timeout")), 5000)
      );
      await Promise.race([statusPromise, timeoutPromise]);
      console.log("[Test Gateway] Gateway process exited");
    } catch (error) {
      console.log(`[Test Gateway] Gateway process exit error: ${error}`);
      // Force kill if SIGTERM didn't work
      try {
        process.kill("SIGKILL");
      } catch {
        // Already dead
      }
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
        console.log("[Test Gateway] Killing HTTP server...");
        httpServerProcess.kill("SIGTERM");
        const statusPromise = httpServerProcess.status;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("HTTP server shutdown timeout")), 2000)
        );
        await Promise.race([statusPromise, timeoutPromise]);
        console.log("[Test Gateway] HTTP server exited");
      } catch (error) {
        console.log(`[Test Gateway] HTTP server exit error: ${error}`);
        try {
          httpServerProcess.kill("SIGKILL");
        } catch {
          // Already dead
        }
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
        console.log("[Test Gateway] Killing SSE server...");
        sseServerProcess.kill("SIGTERM");
        const statusPromise = sseServerProcess.status;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SSE server shutdown timeout")), 2000)
        );
        await Promise.race([statusPromise, timeoutPromise]);
        console.log("[Test Gateway] SSE server exited");
      } catch (error) {
        console.log(`[Test Gateway] SSE server exit error: ${error}`);
        try {
          sseServerProcess.kill("SIGKILL");
        } catch {
          // Already dead
        }
      }
    }

    // Clean up temp config file
    try {
      await Deno.remove(tempConfigFile);
      console.log("[Test Gateway] Removed temp config file");
    } catch {
      // File might already be deleted
    }

    console.log("[Test Gateway] Cleanup complete");
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
