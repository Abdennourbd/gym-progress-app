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
