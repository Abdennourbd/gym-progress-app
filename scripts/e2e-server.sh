#!/usr/bin/env bash
#
# Starts the app for the end to end tests.
#
# The tests run against the local file store rather than the real database, so
# a test run never touches your training data. The empty Redis variables stop
# the server from picking up the cloud store.
#
set -euo pipefail
cd "$(dirname "$0")/.."

HASH=$(node scripts/hash-password.mjs "test-password")

export GYM_EMAIL="test@example.com"
export GYM_PASSWORD_HASH="$HASH"
export AUTH_SECRET="test-secret-test-secret-test-secret-1234"
export KV_REST_API_URL=""
export KV_REST_API_TOKEN=""
export UPSTASH_REDIS_REST_URL=""
export UPSTASH_REDIS_REST_TOKEN=""

exec npm run start -- --port "${PORT:-3210}"
