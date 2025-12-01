# Toolscript Commands Reference

This document provides detailed documentation for all toolscript commands.

## 1. Search for Tools (Recommended)

Search for tools using natural language - this is the fastest way to find relevant MCP tools:

```bash
toolscript search "<query>" [--limit <n>] [--threshold <score>] [--output <format>]
```

**Examples:**

```bash
# Find file-related tools (table output, default)
toolscript search "read files from disk"

# Get TypeScript types directly (types output)
toolscript search "commit git changes" --output types

# Find more results with lower threshold
toolscript search "github api" --limit 5 --threshold 0.2
```

**Output Formats:**

- `--output table` (default): Human-readable table with tool ID, confidence, and description
- `--output types`: Markdown with confidence table + TypeScript code ready for execution

**Types Output Example:**

```markdown
## Search Results

| Tool | Confidence | Reason |
|------|------------|--------|
| git__commit | 85.0% | semantic match, keyword match |
| github__create_commit | 72.3% | partial semantic match |

\`\`\`typescript
// Generated TypeScript code for the matched tools
import { tools } from "toolscript";
// ...
\`\`\`
```

## 2. List Configured Servers

Browse all available MCP servers:

```bash
toolscript list-servers
```

This shows all connected servers available on the Toolscript gateway.

## 3. List Tools from a Server

List all tools from a specific server:

```bash
toolscript list-tools <server-name>
```

This displays all tools the server provides with brief descriptions.

## 4. Get TypeScript Types

Get TypeScript types for specific tools:

```bash
toolscript get-types [--filter <filter>]
```

**Filter format:** Comma-separated list of server names or tool IDs

```bash
# All tools from a server
toolscript get-types --filter octocode

# Specific tool
toolscript get-types --filter octocode__githubSearchCode

# Multiple filters
toolscript get-types --filter github,git__commit
```

This shows the exact TypeScript interface for the tool's parameters and return value.

## 5. Execute Toolscript

After understanding the tool schema, execute it:

**Inline code:**
```bash
toolscript exec '<typescript-code>'
```

**From file:**
```bash
toolscript exec --file <path-to-file.ts>
```

## 6. Gateway Status (Diagnostic)

Check if the gateway is running:

```bash
toolscript gateway status
```

**Use this command only when troubleshooting connection errors or unexpected behavior.**

## Toolscript Format

Toolscripts are TypeScript files that import and use MCP tools:

```typescript
import { tools } from "toolscript";

// Call tools using generated client
const result = await tools.serverName.toolName({
  param1: "value1",
  param2: "value2",
});

console.log(result);
```

## Security

Toolscripts run in a Deno sandbox with:

- Network access restricted to gateway server only
- No file system access
- No environment variable access (except TOOLSCRIPT_GATEWAY_URL)

## Search Statistics (Diagnostic)

Check search engine statistics:

```bash
curl $TOOLSCRIPT_GATEWAY_URL/search/stats
```

This shows:
- Number of indexed tools
- Search performance metrics
- Embedding model status
