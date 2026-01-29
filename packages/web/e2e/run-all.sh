#!/bin/bash
# Web UI E2E Test Runner
# Usage: ./run-all.sh [--headed]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_PREFIX="e2e-$(date +%s)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
HEADED=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      HEADED="--headed"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo "================================"
echo "Web UI E2E Test Suite"
echo "================================"
echo "Session prefix: $SESSION_PREFIX"
echo "Base URL: $BASE_URL"
echo "Headed: ${HEADED:-no}"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
  echo -e "${GREEN}✓ PASS${NC}: $1"
}

fail() {
  echo -e "${RED}✗ FAIL${NC}: $1"
  FAILED=1
}

FAILED=0
TEST_COUNT=0
PASS_COUNT=0

# Run test scripts (each with unique session)
run_test() {
  local name=$1
  local script=$2
  local session="${SESSION_PREFIX}-${TEST_COUNT}"

  TEST_COUNT=$((TEST_COUNT + 1))
  echo ""
  echo "--- $name ---"

  if bash "$SCRIPT_DIR/$script" "$session" "$BASE_URL" $HEADED; then
    pass "$name"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    fail "$name"
  fi

  # Delay between tests to prevent crashes
  sleep 2
}

# Execute tests
run_test "Navigation Test" "navigation/basic.sh"
run_test "Dashboard Test" "dashboard/basic.sh"
run_test "Tasks Test" "tasks/crud.sh"
run_test "Sessions Test" "sessions/basic.sh"
run_test "Agents Test" "agents/basic.sh"
run_test "Memory Test" "memory/basic.sh"
run_test "Settings Test" "settings/basic.sh"

# Summary
echo ""
echo "================================"
echo "Results: $PASS_COUNT/$TEST_COUNT tests passed"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
