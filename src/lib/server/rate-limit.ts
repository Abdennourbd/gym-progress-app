import { getStore } from './store';

/**
 * A limiter for the places where guessing is cheap for the attacker.
 *
 * The count lives in the same store as everything else when there is one, so
 * the limit holds across every instance of the app. A serverless deployment
 * runs many instances at once, and a counter that only one of them knows
 * about is not a limit. Without a cloud store the count is kept in memory,
 * which is enough for a single process and is honest about what it can do.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const PREFIX = 'gym:v1:rl:';

/**
 * The switch used by the end to end tests.
 *
 * It only works with the local file store, which is the development and test
 * setup. A deployment uses the cloud store, so the limiter is always on
 * there, whatever the environment says.
 */
function switchedOff(): boolean {
  return process.env.GYM_STORE === 'local' && process.env.DISABLE_RATE_LIMIT === '1';
}

function keyOf(key: string): string {
  return `${PREFIX}${key}`;
}

function inMemoryCount(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  if (bucket.resetAt <= Date.now()) {
    buckets.delete(key);
    return 0;
  }
  return bucket.count;
}

function inMemoryHit(key: string, windowMs: number): number {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  bucket.count += 1;
  return bucket.count;
}

/**
 * How many attempts have been counted in the current window.
 *
 * Zero when there are none. Used to stop the work before it is done, so a
 * blocked attempt costs nothing.
 */
export async function count(key: string): Promise<number> {
  if (switchedOff()) return 0;

  const store = getStore();
  if (store.count) {
    try {
      return await store.count(keyOf(key));
    } catch {
      // The store is unreachable. Fall back to the in memory count.
    }
  }

  return inMemoryCount(key);
}

/**
 * Counts one attempt and returns the running total.
 */
export async function hit(key: string, windowMs: number): Promise<number> {
  if (switchedOff()) return 0;

  const store = getStore();
  if (store.increment) {
    try {
      return await store.increment(keyOf(key), windowMs);
    } catch {
      // The store is unreachable. Fall back to the in memory count rather
      // than letting every attempt through.
    }
  }

  return inMemoryHit(key, windowMs);
}
