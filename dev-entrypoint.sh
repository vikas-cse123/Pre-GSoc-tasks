#!/bin/sh
# scripts/dev-entrypoint.sh
#
# TASK 2 — Dockerization
#
# Replaces the original hardcoded "sleep 10" approach.
# This script is only used when running the dev container standalone
# (not via docker-compose, which uses separate services + health checks).
#
# When run standalone, it starts the Firebase emulators in the background,
# waits for Firestore to be genuinely ready by polling its REST endpoint,
# then starts the Vite dev server in the foreground.

set -e

FIRESTORE_PORT=${FIRESTORE_EMULATOR_PORT:-8080}
MAX_WAIT=120   # seconds before giving up
WAITED=0

echo "▶  Starting Firebase emulators..."
firebase emulators:start \
  --import=./testdata \
  --export-on-exit=./testdata \
  --project demo-codelabz &

EMULATOR_PID=$!

echo "⏳ Waiting for Firestore emulator on port ${FIRESTORE_PORT}..."

until wget --quiet --tries=1 --spider "http://localhost:${FIRESTORE_PORT}" 2>/dev/null; do
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo "✖  Timed out waiting for Firestore emulator after ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
done

echo "✔  Firestore emulator is ready (waited ${WAITED}s)"
echo "▶  Starting Vite dev server..."

# Start Vite in foreground; if it exits, also stop the emulators
npm run dev -- --host 0.0.0.0 &
VITE_PID=$!

# Wait for either process to exit; exit with its code
wait -n $EMULATOR_PID $VITE_PID
EXIT_CODE=$?

# Clean up the other process
kill $EMULATOR_PID $VITE_PID 2>/dev/null || true

exit $EXIT_CODE
