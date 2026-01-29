#!/bin/bash
# Agents Test
# Usage: ./agents/basic.sh <session> <base_url> [--headed]

SESSION=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing Agents..."

# Open Agents page
agent-browser --session "$SESSION" $HEADED open "$BASE_URL/agents"
agent-browser --session "$SESSION" wait 2000

# Check we're on agents page via URL
URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "")
if [[ "$URL" != *"/agents"* ]]; then
  echo "Failed: Not on Agents page (got: $URL)"
  agent-browser --session "$SESSION" close 2>/dev/null || true
  exit 1
fi

agent-browser --session "$SESSION" close 2>/dev/null || true
echo "Agents test completed"
