#!/bin/bash
# CCSO — Claude Code Smart Optimizer
cd "/Users/yigalmaazuz/Desktop/ccso/ccso"

echo "⚡ מפעיל CCSO v3.0.0..."
echo ""

# Start dashboard in background
node src/dashboard/server.js &
DASHBOARD_PID=$!

sleep 1

# Open dashboard in browser
open http://localhost:3847

echo "✅ דשבורד פועל על http://localhost:3847"
echo ""
echo "מפעיל את ה-REPL..."
echo "────────────────────────────────────"

# Start REPL (foreground)
node src/index.js

# When REPL exits, kill dashboard too
kill $DASHBOARD_PID 2>/dev/null
