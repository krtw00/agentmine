#!/bin/bash
# Settings Test
# Usage: ./settings/basic.sh <session> <base_url> [--headed]

SESSION=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing Settings..."

# Open Settings page
agent-browser --session "$SESSION" $HEADED open "$BASE_URL/settings"
agent-browser --session "$SESSION" wait 2000

# Check we're on settings page via URL
URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "")
if [[ "$URL" != *"/settings"* ]]; then
  echo "Failed: Not on Settings page (got: $URL)"
  agent-browser --session "$SESSION" close 2>/dev/null || true
  exit 1
fi

agent-browser --session "$SESSION" close 2>/dev/null || true
echo "Settings test completed"
