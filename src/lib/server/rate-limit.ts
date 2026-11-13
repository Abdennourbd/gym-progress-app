/**
 * A small in-memory limiter.
 *
 * It is not a wall. In a serverless runtime the count lives on one instance,
 * so this stops a script and not a determined distributed attack. Its job is
 * to keep an open signup from filling the database.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  // End-to-end tests sign in many times from the same place; the limiter is
  // for a public deployment, not for a test run.
  if (process.env.DISABLE_RATE_LIMIT === '1') {
    return true;
  }

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
