#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

node demo/reset.js

echo
echo "  Demo world:  demo/work/project"
echo "  Protocol:    demo/work/project/protocol.json  (ASSAY task envelope)"
echo
echo "  Install once (if needed):  bash scripts/install-plugin.sh"
echo "  Then:                      opencode demo/work/project"
echo
