#!/bin/bash
# CCSO — Claude Code Smart Optimizer
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "⚡ מפעיל CCSO v3.0.0..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js לא נמצא. התקן Node 18+ ונסה שוב."
  exit 1
fi

# Start dashboard in background only if it is not already running
DASHBOARD_STARTED_BY_SCRIPT=0
if ! curl -fsS "http://localhost:3847/api/stats" >/dev/null 2>&1; then
  node src/dashboard/server.js >/tmp/ccso-dashboard.log 2>&1 &
  DASHBOARD_PID=$!
  DASHBOARD_STARTED_BY_SCRIPT=1

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "http://localhost:3847/api/stats" >/dev/null 2>&1; then
      break
    fi
    sleep 0.3
  done
fi

# Open dashboard in browser
open http://localhost:3847

echo "✅ דשבורד פועל על http://localhost:3847"
echo ""
echo "מפעיל את ה-REPL..."
echo "────────────────────────────────────"

# Start REPL (foreground)
node bin/cc.js

# When REPL exits, kill dashboard too only if this launcher started it
if [ "$DASHBOARD_STARTED_BY_SCRIPT" -eq 1 ]; then
  kill "$DASHBOARD_PID" 2>/dev/null
fi
