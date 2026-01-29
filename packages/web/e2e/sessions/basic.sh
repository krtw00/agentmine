#!/bin/bash
# Sessions Test
# Usage: ./sessions/basic.sh <session> <base_url> [--headed]

SESSION=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing Sessions..."

# Open Sessions page
agent-browser --session "$SESSION" $HEADED open "$BASE_URL/sessions"
agent-browser --session "$SESSION" wait 2000

# Check we're on sessions page via URL
URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "")
if [[ "$URL" != *"/sessions"* ]]; then
  echo "Failed: Not on Sessions page (got: $URL)"
  agent-browser --session "$SESSION" close 2>/dev/null || true
  exit 1
fi

agent-browser --session "$SESSION" close 2>/dev/null || true
echo "Sessions test completed"
