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
