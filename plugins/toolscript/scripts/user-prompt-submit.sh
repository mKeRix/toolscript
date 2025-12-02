#!/bin/bash

# UserPromptSubmit hook - Intelligent context injection based on user prompt

set -e

# Read and parse the input JSON
INPUT_JSON=$(cat)

# Extract user prompt and session_id
USER_PROMPT=$(echo "$INPUT_JSON" | jq -r '.prompt')
SESSION_ID=$(echo "$INPUT_JSON" | jq -r '.session_id')

# Gateway URL file location
URL_FILE="${TMPDIR}toolscript-gateway-${SESSION_ID}.url"

# Exit early if no gateway URL file exists (no toolscript without gateway)
if [ ! -f "$URL_FILE" ]; then
    exit 0
fi

# Read gateway URL from file
GATEWAY_URL=$(cat "$URL_FILE" 2>/dev/null || echo "")

# Exit early if gateway URL is empty
if [ -z "$GATEWAY_URL" ]; then
    exit 0
fi

# Call toolscript CLI command to generate intelligent context
# The command will:
# 1. Discover all skills
# 2. Use Claude Agent SDK to select relevant skills and tool queries
# 3. Search gateway for matching tools
# 4. Format context text
# 5. Output hook JSON response
toolscript context claude-usage-suggestion \
    --prompt "$USER_PROMPT" \
    --gateway-url "$GATEWAY_URL" 2>> "${TMPDIR}toolscript-gateway-${SESSION_ID}.log" || exit 0
