---
name: toolscript
description: This skill should be used before performing any task to check for available MCP tools, including "search", "code lookup", "API calls", "file operations", "data queries". Also use when user asks to "call tool", "list tools", "discover tools". Discover and execute MCP tools via gateway.
---

# Toolscript Skill

Discover and execute MCP tools through the toolscript gateway.

**Use proactively:** Before any operation, search for specialized MCP tools that might provide better capabilities.

## Quick Start

```bash
# Search for tools and get TypeScript code
toolscript search "commit git changes" --output types

# Execute the generated code
toolscript exec '<typescript-code-from-search>'
```

## Primary Workflow: Search-Based

```bash
toolscript search "<what-you-need>" --output types  # Get code (use --threshold 0.1 for more)
toolscript exec '<typescript-code>'                 # Execute inline
toolscript exec --file script.ts                    # Or from file
```

## Alternative: Browse-Based

```bash
toolscript list-servers                    # List MCP servers
toolscript list-tools <server-name>        # List tools
toolscript get-types --filter <server>     # Get types
toolscript exec --file script.ts           # Execute
```

## Toolscript Format

```typescript
import { tools } from "toolscript";

const result = await tools.serverName.toolName({
  param1: "value1",
});
```

## References

- **`references/commands.md`** - All commands and options
- **`references/configuration.md`** - Gateway, requirements, server setup
- **`references/troubleshooting.md`** - Diagnostics and fixes
- **`references/examples.md`** - Working examples
