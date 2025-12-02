# Toolscript

> Token-efficient tool usage via MCP Code Mode: Execute TypeScript code that calls MCP tools with full type safety.

Toolscript is a lightweight CLI tool and Claude Code plugin that enables LLMs to write TypeScript code calling MCP (Model Context Protocol) tools. It provides automatic type generation, sandboxed execution, and seamless Claude Code integration.

## Features

- **Type-Safe MCP Access**: Automatic TypeScript type generation from MCP tool schemas
- **Semantic Tool Search**: AI-powered search using embeddings + fuzzy matching for tool discovery
- **Sandboxed Execution**: Secure Deno sandbox with minimal permissions
- **Tool Filtering**: Only expose the tools from a server that you really need
- **Claude Plugin**: Automatic gateway lifecycle management and hooks that auto-suggest relevant skills & tools

## Why should I use this?

The idea of using MCP tools as code instead of direct LLM calls was described in popular blog posts from [Anthropic](https://www.anthropic.com/engineering/code-execution-with-mcp) and [CloudFlare](https://blog.cloudflare.com/code-mode/).
The main problems with the current protocol implementations are:

1. **MCP Context Bloat:** All MCP tools with their descriptions and schemas are loaded into the system context, taking up significant space of the valuable context window and costing you money on each request. The more MCP tools you add to your agent, the more bloated it will get.
2. **Tool Results Become Context:** When the LLM chains multiple tool calls together to fulfill a more advanced request, all intermediate tool results are passed back to the model, adding more tokens to the context. Large context sizes from multiple heavy tool calls can make the LLM more likely to make mistakes when copying data between the different tool calls.

Toolscript solves these issues by:

1. Only exposing the tool definitions needed to the LLM through a search interface, leading to minimal context waste from system instructions
2. Allowing deterministic chaining of tool calls, with data passed directly between the calls, limiting the output processed by the LLM to only the relevant results

The goal of the project is to enable agents to be more cost-efficient and accurate at complex tasks.

## Quick Start

### Pre-Requisites

Toolscript requires the following to be available on the machine it is run on:

- [Deno 2.x](https://docs.deno.com/runtime/getting_started/installation/)
- [jq](https://jqlang.org/)

### Installation

The Toolscript CLI can be installed from [JSR](https://jsr.io/@toolscript/cli):

```bash
deno install --global --allow-net --allow-read --allow-write --allow-env --allow-run --allow-sys --allow-ffi --unstable-webgpu --name toolscript jsr:@toolscript/cli
```

#### Claude Code

To install the matching Claude Code plugin, open `claude` and type:

```text
/plugin marketplace add mKeRix/toolscript
/plugin install toolscript@toolscript
```

Finally, restart Claude Code to activate the plugin.

#### Other Agentic Tools

There are no special integrations for other agentic tools available yet, but as a CLI Toolscript can be used by any agent that has shell access.
To do so, please ensure that a gateway is running on your machine (via `toolscript gateway start`) and then instruct your agent (via system prompt, plugins etc.) how to find and use tools.
You can take inspiration from the [Claude Code skill definition](./plugins/toolscript/skills/toolscript/SKILL.md) to do so.

### Configuration

You can create `.toolscript.json` files on two levels to configure the servers it will load, which are merged together into the configuration that will be used. If a server name appears in multiple files, the latest definition wins.

- `~/.toolscript.json` - user-level configuration for servers that you want to have enabled across all projects you are working on
- `.toolscript.json` - project-level configuration for servers that are specific to a single repository or should be shared with your team via the repository

The Toolscript config format resembles the MCP configuration found in [Claude Code](https://code.claude.com/docs/en/mcp) to make porting between the tools easier. An example config can be found below:

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {
        "LOG_LEVEL": "debug"
      },
      "includeTools": ["read_file", "write_file"],
      "excludeTools": ["delete_file"]
    },
    "web-search": {
      "type": "http",
      "url": "http://localhost:3000",
      "headers": {
        "Authorization": "Bearer ${SEARCH_API_KEY:-default-key}"
      }
    },
    "github": {
      "type": "sse",
      "url": "https://api.example.com/github",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

The configuration files support environment variable substitution using `${VAR}` or `${VAR:-default}` syntax.

After any changes in the configuration you must restart your Claude Code session for it to take effect.

### Direct MCP Access vs Toolscript Access

It is recommended that you keep frequently used tools that don't require chaining directly in your agent configuration, so that it may access the tools without loading Toolscript first.
A practical example:

- context7 - keep in agent configuration, as the output text is directly used by the LLM after single calls & the server only exposes few tools
- atlassian - move to toolscript, as not all tools are needed at all times, the LLM may want to chain multiple calls together & the server adds significant MCP context bloat

### OAuth2 Authentication

Toolscript supports OAuth2 authentication for HTTP and SSE MCP servers using the Authorization Code flow. With a protected MCP server configured, run:

```bash
toolscript auth <server-name>
```

This will:
- Perform OAuth discovery
- Open your browser for authorization
- Store credentials securely in `~/.toolscript/oauth/`

You can also run `toolscript auth` without a server name to list relevant servers and their status.

## Architecture

```
┌─────────────────────┐
│   Toolscript CLI    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐      ┌──────────────────┐
│  Gateway Server     │◄────►│  MCP Server 1    │
│  (HTTP)             │      └──────────────────┘
│  - Type Generation  │      ┌──────────────────┐
│  - Tool Aggregation │◄────►│  MCP Server 2    │
│  - /runtime/tools.ts│      └──────────────────┘
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandboxed Deno     │
│  Subprocess         │
│  - Network: Gateway │
│  - No FS access     │
└─────────────────────┘
```

### Decisions

There are other great tools out there that have similar goals as Toolscript, such as:

- [jx-codes/lootbox](https://github.com/jx-codes/lootbox)
- [portofcontext/pctx](https://github.com/portofcontext/pctx)
- [ipdelete/mcp-code-execution](https://github.com/ipdelete/mcp-code-execution)
- [yoloshii/mcp-code-execution-enhanced](https://github.com/yoloshii/mcp-code-execution-enhanced)
- [elusznik/mcp-server-code-execution-mode](https://github.com/elusznik/mcp-server-code-execution-mode)

None of those satisfied the workflow and requirements I had myself yet though, which is why I ended up building toolscript.
During development, I made a few opinionated choices that differentiate toolscript from these other tools:

1. **Native Claude Code experience:** Toolscript strives for a simple user experience that feels native to Claude Code. For this reason, toolscript currently is compatible with any LLM tool out there, but provides an optimized integration for Claude Code using plugins, skills and hooks.
2. **CLI instead of meta MCP server:** Some work can be done neatly by LLMs using shell commands, such as using the `gh` CLI. Toolscript wants to integrate into these workflows as well without having to pass results through LLM context. For this reason, it is implemented as a CLI that allows piping data between commands.
3. **Lightweight Deno sandboxing instead of Docker:** Containers are a great way to sandbox code, but they are heavy to run and make usage of agents inside containers more difficult. Toolscript utilizes the more lightweight Deno sandbox to guardrail the LLM instead.
4. **Semantic tool search capabilities:** Some servers can expose many tools that would eat a lot of the context window to sift through when just listed. Toolscript implements a semantic tool search as primary workflow to allow the LLM to efficiently retrieve the tool definitions it is actually looking for without having to go through all of them. This allows Toolscript to scale beyond direct MCP integrations in agents.
5. **Skill & tool auto-suggestion:** LLMs can sometimes struggle to remember searching for the tools and skills they have access to, especially in longer conversations. Toolscript implements a context injection hook that automatically runs these steps for the LLM and suggests relevant results to it, streamlining the process and reducing the searching done by the often times more expensive main agent.

## Development

```bash
# Format code
deno fmt

# Lint code
deno lint

# Run tests
deno task test

# Run CLI
deno task cli <command>

# Install command from source
deno install --global \
  --allow-net --allow-read --allow-write --allow-env --allow-run --allow-sys --allow-ffi --unstable-webgpu \
  --name toolscript \
  --config deno.json \
  src/cli/main.ts
```
