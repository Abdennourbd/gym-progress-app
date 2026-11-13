import { getRedis } from './redis';
import { localStore } from './local-store';

/**
 * One small key/value interface over two backends:
 *
 *  - Upstash Redis when the environment variables are set (production)
 *  - a local file when they are not (development with zero configuration)
 *
 * Both behave identically from the caller's point of view, so nothing above
 * this file needs to know which one is running.
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  /**
   * Writes only when the key is free.
   *
   * Returns true when the value was written and false when the key was
   * already taken. It is how a username is claimed without two people
   * reading the same empty record and both writing.
   */
  setIfAbsent<T>(key: string, value: T): Promise<boolean>;
  del(key: string): Promise<void>;
  /**
   * How many times a key has been counted in the current window.
   *
   * Zero when the key is not there. Only the cloud store can answer this
   * across more than one instance, so it is optional.
   */
  count?(key: string): Promise<number>;
  /**
   * Counts one hit in a window and returns the running total.
   *
   * The window starts with the first hit and is repeated by every hit after
   * it, so the count falls back to zero on its own.
   */
  increment?(key: string, windowMs: number): Promise<number>;
  readonly backend: 'redis' | 'local';
}

const redisStore: Store = {
  backend: 'redis',
  async get<T>(key: string) {
    const redis = getRedis();
    if (!redis) throw new Error('redis is not configured');
    return (await redis.get<T>(key)) ?? null;
  },
  async set<T>(key: string, value: T) {
    const redis = getRedis();
    if (!redis) throw new Error('redis is not configured');
    await redis.set(key, value);
  },
  async setIfAbsent<T>(key: string, value: T) {
    const redis = getRedis();
    if (!redis) throw new Error('redis is not configured');
    const result = await redis.set(key, value, { nx: true });
    return result === 'OK';
  },
  async del(key: string) {
    const redis = getRedis();
    if (!redis) throw new Error('redis is not configured');
    await redis.del(key);
  },
  async count(key: string) {
    const redis = getRedis();
    if (!redis) throw new Error('redis is not configured');
    const raw = await redis.get<string | number>(key);
    const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(value) ? value : 0;
  },
  async increment(key: string, windowMs: number) {
    const redis = getRedis();
    if (!redis) throw new Error('redis is not configured');
    const total = await redis.incr(key);

    // The first hit opens the window.
    if (total === 1) {
      try {
        await redis.expire(key, Math.max(1, Math.ceil(windowMs / 1000)));
      } catch {
        // A counter with no end would block whoever it belongs to for good,
        // so it is thrown away instead.
        await redis.del(key);
        return 0;
      }
    }

    return total;
  },
};

const fileStore: Store = {
  backend: 'local',
  async get<T>(key: string) {
    return localStore.get<T>(key);
  },
  async set<T>(key: string, value: T) {
    localStore.set(key, value);
  },
  async setIfAbsent<T>(key: string, value: T) {
    return localStore.setIfAbsent(key, value);
  },
  async del(key: string) {
    localStore.del(key);
  },
};

export function getStore(): Store {
  // An explicit choice always wins, so a test run can never reach the real
  // database by accident.
  if (process.env.GYM_STORE === 'local') return fileStore;
  return getRedis() ? redisStore : fileStore;
}
