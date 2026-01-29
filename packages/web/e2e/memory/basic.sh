#!/bin/bash
# Memory Test
# Usage: ./memory/basic.sh <session> <base_url> [--headed]

SESSION=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing Memory Bank..."

# Open Memory page
agent-browser --session "$SESSION" $HEADED open "$BASE_URL/memory"
agent-browser --session "$SESSION" wait 2000

# Check we're on memory page via URL
URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "")
if [[ "$URL" != *"/memory"* ]]; then
  echo "Failed: Not on Memory page (got: $URL)"
  agent-browser --session "$SESSION" close 2>/dev/null || true
  exit 1
fi

agent-browser --session "$SESSION" close 2>/dev/null || true
echo "Memory test completed"
