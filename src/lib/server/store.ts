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
  async del(key: string) {
    localStore.del(key);
  },
};

export function getStore(): Store {
  return getRedis() ? redisStore : fileStore;
}
