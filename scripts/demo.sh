#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

node demo/reset.js

echo
echo "  Demo world is ready: demo/work/project"
echo
echo "  1. Start Rice:"
echo "       cd pet && npm start"
echo
echo "  2. Open OpenCode in the demo project:"
echo "       opencode demo/work/project"
echo
echo "  3. Ask it to clean the survey data and remove the hardcoded API key."
echo
echo "  Rice reads ~/.rice/events.jsonl — no port."
echo
