#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env --allow-run

/**
 * Toolscript CLI - Main entry point
 */

import { Command } from "@cliffy/command";
import { gatewayCommand } from "./commands/gateway.ts";
import { execCommand } from "./commands/exec.ts";
import { listServersCommand, listToolsCommand } from "./commands/list.ts";
import { getTypesCommand } from "./commands/types.ts";
import { searchCommand } from "./commands/search.ts";
import { authCommand } from "./commands/auth.ts";
import { contextCommand } from "./commands/context.ts";
import packageInfo from "../../deno.json" with { type: "json" };

/**
 * Main CLI command
 */
const main = new Command()
  .name("toolscript")
  .version(packageInfo.version)
  .description("Deno-native MCP code mode CLI tool")
  .command("gateway", gatewayCommand)
  .command("auth", authCommand)
  .command("search", searchCommand)
  .command("list-servers", listServersCommand)
  .command("list-tools", listToolsCommand)
  .command("get-types", getTypesCommand)
  .command("exec", execCommand)
  .command("context", contextCommand);

if (import.meta.main) {
  await main.parse(Deno.args);
}
