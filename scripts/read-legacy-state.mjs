import { readFileSync, writeFileSync } from 'node:fs';
import { Redis } from '@upstash/redis';

/**
 * Reads the dataset the app had before accounts existed and writes it to a
 * file, ready to be copied into a new account.
 *
 *   node scripts/read-legacy-state.mjs /tmp/legacy-state.json
 *
 * The old keys are `gym:v1:exercises`, `gym:v1:sessions` and
 * `gym:v1:settings`. Once the new version is running, nothing reads them any
 * more, so this is how an old dataset is rescued.
 *
 * Environment:
 *   KV_REST_API_URL     the cloud store
 *   KV_REST_API_TOKEN   the cloud store
 */
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^["']|["']$/g, ''),
    ]),
);

const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error('Set KV_REST_API_URL and KV_REST_API_TOKEN in .env.local first.');
  process.exit(1);
}

const redis = new Redis({ url, token });

const LEGACY = {
  exercises: 'gym:v1:exercises',
  sessions: 'gym:v1:sessions',
  settings: 'gym:v1:settings',
  session: (id) => `gym:v1:sessions:${id}`,
};

const exercises = (await redis.get(LEGACY.exercises)) ?? [];
const summaries = (await redis.get(LEGACY.sessions)) ?? [];
const settings = (await redis.get(LEGACY.settings)) ?? null;

const sessions = [];
for (const summary of summaries) {
  const session = await redis.get(LEGACY.session(summary.id));
  if (session) sessions.push(session);
}

const state = { exercises, sessions, settings };

const target = process.argv[2];
if (target) {
  writeFileSync(target, JSON.stringify(state, null, 2));
  console.log(`written to ${target}`);
} else {
  console.log(JSON.stringify(state, null, 2));
}

console.log('read:', {
  exercises: exercises.length,
  sessions: sessions.length,
  settings: settings ? 'yes' : 'no',
});
