# Security Model

## Overview

Toolscript implements defense-in-depth security through multiple layers:

1. **Deno Sandbox**: Permission-based isolation for toolscript execution
2. **Gateway Isolation**: Centralized MCP access point
3. **Network Restrictions**: Limited network access
4. **Environment Isolation**: No access to host environment

## Deno Sandbox

### Permission Model

Toolscripts execute with minimal permissions:

```bash
deno run \
  --allow-net=localhost:PORT  # Network: only gateway server
  --import-map=<temp>         # Import map for module resolution
  --no-prompt                 # No interactive prompts
  script.ts
```

### What's Allowed

- **Network**: HTTP requests to `localhost:PORT` (gateway only)
- **Imports**: TypeScript/JavaScript modules via HTTP from gateway
- **Computation**: Pure JavaScript computation

### What's Denied

- **File System**: No read/write access
- **Environment**: No access to environment variables (except TOOLSCRIPT_GATEWAY_URL)
- **Subprocesses**: Cannot spawn child processes
- **FFI**: No foreign function interface access
- **Network (other)**: No access to external network or other localhost ports

## Gateway Isolation

### Centralized Access

- Gateway is the **only** component with MCP server access
- Toolscripts communicate with gateway via HTTP API
- Gateway validates and proxies requests to MCP servers

### Credential Protection

- MCP server credentials stay in gateway process
- Toolscripts never see credentials
- Environment variables are substituted in gateway, not exposed to toolscripts

## Network Security

### Port Restrictions

- Gateway listens on `localhost` only (not externally accessible)
- Toolscripts can only connect to gateway port
- No external network access from toolscripts

### Transport Security

- Gateway-toolscript communication is HTTP (localhost)
- Gateway-MCP communication uses configured transports (stdio, HTTP, SSE)
- No TLS required for localhost communication

## Environment Isolation

### Environment Variables

Toolscripts have access to only one environment variable:

```typescript
Deno.env.get("TOOLSCRIPT_GATEWAY_URL"); // "http://localhost:PORT"
```

All other environment variables are inaccessible.

### Import Map Isolation

Import maps are generated dynamically per execution:

```json
{
  "imports": {
    "toolscript": "http://localhost:PORT/runtime/tools.ts?_t=TIMESTAMP"
  }
}
```

- Unique timestamp prevents cache poisoning
- Temporary file is deleted after execution
- No persistent state between executions

## Threat Model

### Protected Against

1. **File System Access**
   - Toolscripts cannot read/write host files
   - Protected by Deno's `--allow-read`/`--allow-write` denial

2. **Credential Theft**
   - MCP credentials never exposed to toolscripts
   - Environment variables not accessible

3. **Network Attacks**
   - No external network access
   - No port scanning (only gateway port allowed)

4. **Code Injection**
   - TypeScript/JavaScript execution is sandboxed
   - No shell command execution

5. **Resource Exhaustion**
   - Deno isolates process memory
   - Can be killed by gateway/CLI

### Not Protected Against

1. **Malicious Tool Usage**
   - Toolscripts can call any available MCP tool
   - Tools themselves may have security implications
   - **Mitigation**: Review MCP server configurations

2. **Denial of Service**
   - Infinite loops can consume CPU
   - Large responses can consume memory
   - **Mitigation**: External process monitoring, timeouts

3. **Gateway Compromise**
   - If gateway is compromised, MCP access is compromised
   - **Mitigation**: Run gateway with minimal privileges

## Best Practices

### For Users

1. **Review Configuration**: Only add trusted MCP servers to `.toolscript.json`
2. **Audit Tools**: Understand what tools are available before executing toolscripts
3. **Review Code**: Review LLM-generated toolscripts before execution
4. **Monitor Gateway**: Check gateway logs for unexpected tool calls
5. **Limit Scope**: Use separate configs for different trust levels

### For Developers

1. **Minimal Permissions**: Never add permissions beyond network+gateway
2. **Validate Input**: Gateway should validate tool parameters
3. **Rate Limiting**: Consider rate limiting tool calls
4. **Logging**: Log all tool calls for audit trail
5. **Error Messages**: Don't leak sensitive info in error messages

### For Operators

1. **Isolated Environment**: Run gateway in isolated environment for production
2. **Network Segmentation**: Use firewalls to restrict gateway network access
3. **Secret Management**: Use secure secret management for MCP credentials
4. **Monitoring**: Monitor gateway process and tool call patterns
5. **Updates**: Keep Deno and dependencies up to date

## Comparison with Alternatives

### vs. Docker/Containers

**Toolscript (Deno sandbox)**:

- ✅ Lightweight, fast startup
- ✅ Fine-grained permission control
- ✅ Native Deno integration
- ❌ Less isolation than containers

**Containers**:

- ✅ Stronger isolation
- ❌ Heavier, slower startup
- ❌ More complex setup
- ❌ Overhead for simple use cases

### vs. Web Workers

**Toolscript (subprocess)**:

- ✅ Full TypeScript support
- ✅ Top-level await
- ✅ Better error handling
- ❌ Subprocess overhead

**Web Workers**:

- ✅ In-process, faster
- ❌ Limited API access
- ❌ No top-level await (without workarounds)
- ❌ Message passing complexity

## Security Roadmap

Future enhancements:

1. **Tool-level Permissions**: Allow/deny lists for specific tools
2. **Resource Limits**: CPU, memory, network bandwidth limits
3. **Audit Logging**: Structured audit logs for compliance
4. **Secrets Manager**: Integration with vault/secrets managers
5. **TLS Support**: Optional TLS for gateway-toolscript communication
6. **Role-Based Access**: Multi-user support with role-based tool access
