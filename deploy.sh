#!/usr/bin/env bash
#
# Builds the app and ships it to Vercel.
#
# First run:  npx vercel login          (once)
#             npx vercel link          (once, per project)
# Then:       ./deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

echo "==> building"
npm run build

echo "==> deploying"
npx vercel deploy --prod --yes

echo
echo "Done. The URL is printed above."
echo "Do not forget the environment variables:"
echo "  GYM_EMAIL, GYM_PASSWORD_HASH, AUTH_SECRET,"
echo "  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN"
