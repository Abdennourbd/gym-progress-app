import { Redis } from '@upstash/redis';

let client: Redis | null = null;

/**
 * The Vercel marketplace integration calls these KV_REST_API_*, while a
 * self hosted Upstash database calls them UPSTASH_REDIS_REST_*. Both work.
 */
export function getRedis(): Redis | null {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  client = new Redis({ url, token });
  return client;
}

export const KEYS = {
  exercises: 'gym:v1:exercises',
  sessions: 'gym:v1:sessions',
  settings: 'gym:v1:settings',
  session: (id: string) => `gym:v1:sessions:${id}`,
};
