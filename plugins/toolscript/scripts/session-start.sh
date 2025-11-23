#!/bin/bash

# Start toolscript gateway in background

set -e

# Read and log the input JSON
INPUT_JSON=$(cat)

# Extract session_id from JSON and export CLAUDE_SESSION_ID
export CLAUDE_SESSION_ID=$(echo "$INPUT_JSON" | jq -r '.session_id')

# PID and log file locations based on session_id
PID_FILE="${TMPDIR}toolscript-gateway-${CLAUDE_SESSION_ID}.pid"
LOG_FILE="${TMPDIR}toolscript-gateway-${CLAUDE_SESSION_ID}.log"

# Create CLAUDE_ENV_FILE if not set
if [ -z "$CLAUDE_ENV_FILE" ] && [ -n "$CLAUDE_SESSION_ID" ]; then
    # Use CLAUDE_CONFIG_DIR if set, otherwise default to ~/.claude
    CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
    export CLAUDE_ENV_FILE="$CLAUDE_DIR/session-env/$CLAUDE_SESSION_ID/hook-0.sh"
    # Create the directory if it doesn't exist
    mkdir -p "$(dirname "$CLAUDE_ENV_FILE")"
    # Create the file if it doesn't exist
    touch "$CLAUDE_ENV_FILE"
    echo "✓ Created CLAUDE_ENV_FILE: $CLAUDE_ENV_FILE" >> "$LOG_FILE"
elif [ -z "$CLAUDE_ENV_FILE" ]; then
    echo "ERROR: CLAUDE_ENV_FILE not set and CLAUDE_SESSION_ID is not available" >> "$LOG_FILE"
fi

# Find a free port using Deno
FREE_PORT=$(deno eval 'const l = Deno.listen({ port: 0 }); console.log(l.addr.port); l.close();')

# Start gateway on the free port in background
toolscript gateway start --port "$FREE_PORT" > "$LOG_FILE" 2>&1 &

# Save the PID to file
GATEWAY_PID=$!
echo "$GATEWAY_PID" > "$PID_FILE"

# Construct gateway URL
GATEWAY_URL="http://localhost:$FREE_PORT"

# Write environment variables to CLAUDE_ENV_FILE
if [ -z "$CLAUDE_ENV_FILE" ]; then
    echo "ERROR: CLAUDE_ENV_FILE is not set, cannot persist environment variables" >> "$LOG_FILE"
    exit 1
fi

echo "export TOOLSCRIPT_GATEWAY_URL=$GATEWAY_URL" >> "$CLAUDE_ENV_FILE"
