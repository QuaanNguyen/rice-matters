#!/usr/bin/env bash
# One-shot local demo: rebuild the world, start mock + assay, drive the agent.
#   scripts/demo.sh [scenario] [pace-ms]
set -uo pipefail
cd "$(dirname "$0")/.."

SCENARIO="${1:-hijack}"
PACE="${2:-1400}"
MOCK_PORT="${MOCK_PORT:-4000}"
API_PORT="${API_PORT:-4141}"
EVT_PORT="${EVT_PORT:-4599}"

cleanup() {
  [ -n "${ASSAY_PID:-}" ] && kill "$ASSAY_PID" 2>/dev/null
  [ -n "${MOCK_PID:-}" ] && kill "$MOCK_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

node demo/reset.js

node mock/model.js --port "$MOCK_PORT" --scenario "$SCENARIO" >/tmp/rice-mock.log 2>&1 &
MOCK_PID=$!
sleep 1

node assay/server.js \
  --upstream "http://127.0.0.1:${MOCK_PORT}/v1" \
  --port "$API_PORT" --events-port "$EVT_PORT" \
  --workdir demo/work/project \
  --protocol demo/protocol.json >/tmp/rice-assay.log 2>&1 &
ASSAY_PID=$!
sleep 1.5

cat /tmp/rice-assay.log

node demo/drive.js --api "http://127.0.0.1:${API_PORT}/v1" \
  --workdir demo/work/project --pace "$PACE"

echo "--- run record ---"
ls -1 runs | tail -1
