# Toolscript Troubleshooting Guide

This document provides comprehensive troubleshooting guidance for common toolscript issues.

## Gateway Issues

### Gateway not running

**Symptoms:**
- Connection errors when running toolscript commands
- "Gateway unavailable" messages

**Diagnosis:**
1. Check if `$TOOLSCRIPT_GATEWAY_URL` environment variable is set:
   ```bash
   echo $TOOLSCRIPT_GATEWAY_URL
   ```

2. Check gateway process status:
   ```bash
   toolscript gateway status
   ```

3. Check logs for errors:
   ```bash
   head -50 /tmp/toolscript-gateway-*.log
   ```

**Resolution:**
- Ask the user to restart their Claude Code session to restart the gateway
- The gateway is automatically started via SessionStart hook

### No tools available

**Symptoms:**
- `toolscript list-servers` returns empty
- `toolscript search` finds no tools
- Gateway running but no servers connected

**Diagnosis:**
1. Check if configuration file exists:
   ```bash
   # Check project directory
   ls -la .toolscript.json

   # Check home directory
   ls -la ~/.toolscript.json
   ```

2. List configured servers:
   ```bash
   toolscript list-servers
   ```

**Resolution:**
- Ensure `.toolscript.json` exists in project root or user home directory
- Verify configuration file is valid JSON
- See `configuration.md` for proper configuration format
- After creating/modifying config, ask user to restart Claude Code session

## Server Issues

### Server is missing or not showing up

**Symptoms:**
- Expected server doesn't appear in `list-servers` output
- Tools from a specific server are unavailable

**Diagnosis (follow in order):**

**Step 1: Check if server is configured**
```bash
# List all configured servers
toolscript list-servers
```
If the server doesn't appear, it's not properly configured.

**Step 2: Verify configuration file**
- Check `.toolscript.json` exists in project root or `~/.toolscript.json`
- Verify the server entry is present with correct JSON syntax
- Ensure server `type` is valid (`stdio`, `http`, or `sse`)
- See `configuration.md` for configuration details

**Step 3: Check gateway logs for errors**
```bash
# View gateway startup logs
head -50 /tmp/toolscript-gateway-*.log
```
Look for:
- Configuration parsing errors
- Server connection failures
- Authentication errors
- Missing executable or command errors

**Step 4: Authentication errors**
If logs show authentication failures:
- Verify environment variables are set correctly (e.g., `GITHUB_TOKEN`, `API_KEY`)
- Check credentials are valid and not expired
- For servers requiring authentication setup, run:
  ```bash
  toolscript auth <server-name>
  ```
- After fixing auth, restart Claude Code session to restart gateway

**Step 5: Server-specific issues**
- **stdio servers:** Verify command is executable and args are correct
- **http/sse servers:** Check URL is reachable and returns valid responses
- Test server independently outside toolscript to verify it works

**Step 6: Restart gateway**
If configuration changes were made, ask the user to restart their Claude Code session to apply changes.

### Upstream server errors

**Symptoms:**
- Authentication failures
- Connection timeouts
- Server errors during tool execution

**Important:** These are gateway-level issues, not toolscript issues.

**Diagnosis:**
1. Check gateway logs for detailed error messages:
   ```bash
   head -50 /tmp/toolscript-gateway-*.log
   ```

2. Review `.toolscript.json` configuration for server credentials

3. Verify server command and environment variables are correct

4. Ensure required API keys are set in server configuration

**Resolution:**
- Fix configuration in `.toolscript.json`
- Set missing environment variables
- For authentication issues, try `toolscript auth <server-name>`
- Restart Claude Code session to apply changes

## Search Issues

### Search not working

**Symptoms:**
- `toolscript search` returns errors
- No results when tools should exist
- Search command hangs or times out

**Diagnosis:**
1. Check gateway is running (search requires active gateway):
   ```bash
   toolscript gateway status
   ```

2. Check search statistics:
   ```bash
   curl $TOOLSCRIPT_GATEWAY_URL/search/stats
   ```

3. Review gateway logs for search errors:
   ```bash
   head -50 /tmp/toolscript-gateway-*.log
   ```

**Resolution:**
- If semantic search fails, gateway falls back to fuzzy-only mode
- Use `--threshold 0.1` to see more results with lower confidence
- Try exact tool names with `list-tools` if search is unavailable
- Restart gateway if search engine isn't initializing

### Low confidence search results

**Symptoms:**
- Search returns wrong tools
- Confidence scores are low (<40%)
- Expected tools don't appear in results

**Diagnosis:**
Use more specific search terms or try different phrasing:
```bash
# Too generic
toolscript search "files"

# More specific
toolscript search "read file contents from filesystem"
```

**Resolution:**
- Use `--threshold 0.1` to see more results
- Try different search queries with synonyms
- Use `--limit 10` to see more potential matches
- Fall back to `list-tools` to browse all tools

## Configuration Issues

### Invalid JSON syntax

**Symptoms:**
- Gateway fails to start
- Configuration parsing errors in logs
- Unexpected server behavior

**Diagnosis:**
Check gateway logs for JSON parsing errors:
```bash
head -50 /tmp/toolscript-gateway-*.log
```

**Resolution:**
- Validate JSON syntax using a JSON validator
- Check for:
  - Missing commas between entries
  - Unclosed quotes or brackets
  - Invalid escape sequences
- See `configuration.md` for valid examples

### Environment variables not resolved

**Symptoms:**
- Authentication failures despite correct credentials
- Tools receive empty or literal `${VAR_NAME}` values

**Diagnosis:**
1. Check variables are set in the environment:
   ```bash
   echo $GITHUB_TOKEN
   echo $API_KEY
   ```

2. Review gateway logs for substitution errors:
   ```bash
   head -50 /tmp/toolscript-gateway-*.log
   ```

**Resolution:**
- Set missing environment variables before starting Claude Code
- Verify syntax is `${VAR_NAME}` (not `$VAR_NAME` or `{VAR_NAME}`)
- Restart Claude Code session after setting environment variables

## Execution Issues

### Toolscript execution fails

**Symptoms:**
- `toolscript exec` returns errors
- Type errors in generated code
- Runtime errors during execution

**Diagnosis:**
1. Check the TypeScript code for syntax errors
2. Verify parameter types match tool schema
3. Use `get-types` to confirm expected types:
   ```bash
   toolscript get-types --filter tool_name
   ```

**Resolution:**
- Fix TypeScript syntax errors
- Ensure parameters match the tool's expected schema
- Test with simpler parameter values first
- Check gateway logs for detailed error messages

### Permission denied errors

**Symptoms:**
- Deno permission errors during execution
- Network or filesystem access denied

**Explanation:**
Toolscripts run in a Deno sandbox with restricted permissions by design:
- Network access: Only to gateway server
- Filesystem access: None
- Environment variables: Only `TOOLSCRIPT_GATEWAY_URL`

**Resolution:**
This is expected behavior for security. All external operations must go through MCP tools, not direct Deno APIs.

## Diagnostic Commands Summary

Quick reference for diagnostic commands:

```bash
# Check gateway status
toolscript gateway status

# View startup logs (most errors here)
head -50 /tmp/toolscript-gateway-*.log

# List configured servers
toolscript list-servers

# Check search statistics
curl $TOOLSCRIPT_GATEWAY_URL/search/stats

# Verify environment variable
echo $TOOLSCRIPT_GATEWAY_URL

# Check configuration files
ls -la .toolscript.json ~/.toolscript.json
```

## When to Restart Gateway

Ask the user to restart their Claude Code session (which restarts the gateway) when:
- Configuration changes were made to `.toolscript.json`
- Environment variables were added or modified
- Gateway is in a bad state (crashed, hung, or unresponsive)
- After fixing authentication issues
- After installing new MCP servers

**Important:** Do not try to start/restart the gateway yourself. Only the SessionStart hook can properly initialize the gateway.
