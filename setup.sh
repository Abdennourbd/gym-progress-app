#!/usr/bin/env bash
#
# Prints everything you need to paste into Vercel's environment variables.
#
#   ./setup.sh "you@example.com" "your password"
#
set -euo pipefail
cd "$(dirname "$0")"

EMAIL="${1:-}"
PASSWORD="${2:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "usage: ./setup.sh \"you@example.com\" \"your password\"" >&2
  exit 1
fi

HASH=$(node scripts/hash-password.mjs "$PASSWORD")
SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")

cat <<EOF

Add these three environment variables in Vercel (Settings -> Environment Variables):

GYM_EMAIL
$EMAIL

GYM_PASSWORD_HASH
$HASH

AUTH_SECRET
$SECRET

Then add Upstash Redis from the Vercel Marketplace. It fills in
UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for you.

EOF
