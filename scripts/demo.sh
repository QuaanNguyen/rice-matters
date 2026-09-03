#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

node demo/reset.js

echo
echo "  Demo world is ready: demo/work/project"
echo "  Protocol:            demo/work/project/protocol.json"
echo "  Plugin:              ~/.config/opencode/plugins/rice.js  (global; not copied into the demo)"
echo
echo "  0. If you have not installed Rice on this machine:"
echo "       bash scripts/install-plugin.sh"
echo
echo "  1. Start Rice:"
echo "       cd pet && npm start"
echo
echo "  2. Open OpenCode in the demo project (global plugin loads):"
echo "       opencode demo/work/project"
echo
echo "  3. Ask it to clean the survey data and remove the hardcoded API key."
echo
