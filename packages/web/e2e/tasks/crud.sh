#!/bin/bash
# Tasks Test
# Usage: ./tasks/crud.sh <session> <base_url> [--headed]

SESSION=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing Tasks..."

# Open Tasks page
agent-browser --session "$SESSION" $HEADED open "$BASE_URL/tasks"
agent-browser --session "$SESSION" wait 2000

# Check we're on tasks page via URL
URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "")
if [[ "$URL" != *"/tasks"* ]]; then
  echo "Failed: Not on Tasks page (got: $URL)"
  agent-browser --session "$SESSION" close 2>/dev/null || true
  exit 1
fi

agent-browser --session "$SESSION" close 2>/dev/null || true
echo "Tasks test completed"
