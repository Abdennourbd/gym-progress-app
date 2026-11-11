import { Redis } from '@upstash/redis';

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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
