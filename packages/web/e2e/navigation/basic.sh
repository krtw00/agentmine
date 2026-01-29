#!/bin/bash
# Navigation Test (Direct URL Access - New Session Per Page)
# Usage: ./navigation/basic.sh <session_prefix> <base_url> [--headed]

SESSION_PREFIX=$1
BASE_URL=$2
HEADED=$3

set -e

echo "Testing navigation (direct URL access)..."

# Test each page is accessible (new session per page to avoid crashes)
check_page() {
  local path=$1
  local title=$2
  local session="${SESSION_PREFIX}-${title}"

  agent-browser --session "$session" $HEADED open "$BASE_URL$path" 2>/dev/null
  agent-browser --session "$session" wait 1500 2>/dev/null

  # Verify we're on the correct page
  URL=$(agent-browser --session "$session" get url 2>/dev/null || echo "")

  # Close session immediately
  agent-browser --session "$session" close 2>/dev/null || true

  if [[ "$URL" != *"$path"* && "$path" != "/" ]]; then
    echo "  $title ($path) -> FAIL (got: $URL)"
    return 1
  fi
  echo "  $title ($path) -> OK"

  # Small delay between tests
  sleep 1
}

check_page "/" "Dashboard"
check_page "/tasks" "Tasks"
check_page "/workers" "Workers"
check_page "/sessions" "Sessions"
check_page "/agents" "Agents"
check_page "/memory" "Memory"
check_page "/settings" "Settings"

echo "Navigation test completed"
