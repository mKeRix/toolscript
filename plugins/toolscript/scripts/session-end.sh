#!/bin/bash

# Stop toolscript gateway

set -e

# Read and log the input JSON
INPUT_JSON=$(cat)

# Extract session_id from JSON
SESSION_ID=$(echo "$INPUT_JSON" | jq -r '.session_id')

# PID, URL, and log file locations based on session_id
PID_FILE="${TMPDIR}toolscript-gateway-${SESSION_ID}.pid"
URL_FILE="${TMPDIR}toolscript-gateway-${SESSION_ID}.url"
LOG_FILE="${TMPDIR}toolscript-gateway-${SESSION_ID}.log"

# Read PID from file
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")

  # Kill the gateway process
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Stopped toolscript gateway (PID $PID)"
  fi

  # Cleanup PID file
  rm -f "$PID_FILE"
fi

# Cleanup URL and log files
rm -f "$URL_FILE"
rm -f "$LOG_FILE"
