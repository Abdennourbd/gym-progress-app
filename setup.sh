#!/usr/bin/env bash
#
# Prints everything you need to paste into Vercel's environment variables.
#
#   ./setup.sh
#
# There is no account to set up. Anyone who opens the app can make one, and
# each account keeps its own workouts.
#
set -euo pipefail
cd "$(dirname "$0")"

SECRET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")

cat <<EOF

Add this environment variable in Vercel (Settings -> Environment Variables):

AUTH_SECRET
$SECRET

Then add Upstash Redis from the Vercel Marketplace. It fills in
UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for you.

Signups are open. To ask people for a code first, add this too:

GYM_INVITE_CODE
any-long-random-string-you-choose

EOF
