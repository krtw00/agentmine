#!/bin/bash
# Dashboard Test
# Usage: ./dashboard/basic.sh <session> <base_url> [--headed]

SESSION=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing Dashboard..."

# Open Dashboard
agent-browser --session "$SESSION" $HEADED open "$BASE_URL"
agent-browser --session "$SESSION" wait 2000

# Check we're on dashboard via URL
URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "")
if [[ "$URL" != "$BASE_URL" && "$URL" != "$BASE_URL/" ]]; then
  echo "Failed: Not on Dashboard page (got: $URL)"
  agent-browser --session "$SESSION" close 2>/dev/null || true
  exit 1
fi

agent-browser --session "$SESSION" close 2>/dev/null || true
echo "Dashboard test completed"
