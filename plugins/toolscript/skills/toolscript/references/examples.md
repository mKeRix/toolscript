# Toolscript Examples

## Discovery Workflows

### Primary Workflow: Search-Based

```bash
# Search for tools and get TypeScript code
toolscript search "commit git changes" --output types

# Execute the generated code
toolscript exec '<typescript-code-from-search>'
```

Use `--threshold 0.1` for more results:
```bash
toolscript search "database query" --output types --threshold 0.1
```

### Alternative: Direct Tool Access

If you already know which MCP tools to use:

```bash
toolscript get-types --filter git_commit  # Get specific tool's TypeScript types
toolscript exec '<typescript-code>'       # Execute inline
```

### Alternative: Browse-Based Discovery

```bash
toolscript list-servers                    # List MCP servers
toolscript list-tools github               # List tools from server
toolscript get-types --filter github       # Get types for server
toolscript exec --file script.ts           # Execute from file
```

## Code Examples

### Basic Example: Single Tool Call

```typescript
import { tools } from "toolscript";

// List directory contents using filesystem server
const result = await tools.filesystem.listDirectory({
  path: "/tmp",
});

console.log("Files:", result);
```

## Multi-Step Workflow

```typescript
import { tools } from "toolscript";

// Read a file, process it, and write result
const content = await tools.filesystem.readFile({
  path: "/tmp/input.txt",
});

// Process the content (example)
const processed = content.toUpperCase();

// Write back
await tools.filesystem.writeFile({
  path: "/tmp/output.txt",
  content: processed,
});

console.log("Processing complete");
```

## Error Handling

```typescript
import { tools } from "toolscript";

try {
  const result = await tools.github.createIssue({
    title: "Bug Report",
    body: "Description here",
  });
  console.log(`Created issue: ${result.url}`);
} catch (error) {
  console.error(`Failed to create issue: ${error}`);
}
```

## Parallel Execution

```typescript
import { tools } from "toolscript";

// Execute multiple tool calls in parallel
const [users, repos] = await Promise.all([
  tools.github.listUsers({ org: "myorg" }),
  tools.github.listRepos({ org: "myorg" }),
]);

console.log(`Found ${users.length} users and ${repos.length} repos`);
```

## Conditional Logic

```typescript
import { tools } from "toolscript";

const file = await tools.filesystem.readFile({
  path: "/tmp/config.json",
});

const config = JSON.parse(file);

if (config.mode === "production") {
  await tools.deployment.deploy({
    environment: "prod",
    version: config.version,
  });
} else {
  console.log("Skipping deployment in dev mode");
}
```
