#!/usr/bin/env bash
#
# Starts the app for the end to end tests.
#
# The tests run against the local file store rather than the real database, so
# a test run never touches your training data.
#
set -euo pipefail
cd "$(dirname "$0")/.."

export GYM_STORE="local"
export AUTH_SECRET="test-secret-test-secret-test-secret-1234"

exec npm run start -- --port "${PORT:-3210}"
