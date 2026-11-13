import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { Redis } from '@upstash/redis';

/**
 * Fills the shared demo account with a month of training that looks like a
 * real member using the app: the big lifts move up, a few accessories stall,
 * so every muscle chart has something to say.
 *
 *   node scripts/seed-demo.mjs
 *
 * Safe to re-run: the demo account is wiped and written again from scratch.
 * The demo user's password is random and never printed; visitors sign in
 * through "Look around as a visitor" instead.
 *
 * Environment (from .env.local):
 *   KV_REST_API_URL, KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN)
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

const N = 16384;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt.${N}.${R}.${P}.${salt.toString('base64')}.${hash.toString('base64')}`;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261113);
const jitter = (spread) => (rand() - 0.5) * 2 * spread;

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const today = new Date();
const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
const dayAt = (daysAgo) => midnight - daysAgo * DAY;
const dateStr = (daysAgo) => new Date(dayAt(daysAgo)).toISOString().slice(0, 10);

// The program: Push / Pull / Legs rotating, plus one full-body day. Weights
// are written per session index so the lifts climb over the month.
const EXERCISES = [
  { key: 'bench', name: 'Barbell Bench Press', muscles: ['chest'], target: [5, 8], stepKg: 2.5, sets: 4, reps: 7 },
  { key: 'incline', name: 'Incline Dumbbell Press', muscles: ['chest'], target: [8, 10], stepKg: 2, sets: 3, reps: 9 },
  { key: 'machine', name: 'Machine Chest Press', muscles: ['chest'], target: [8, 12], stepKg: 2.5, sets: 3, reps: 10 },
  { key: 'ohp', name: 'Overhead Press', muscles: ['shoulders'], target: [5, 8], stepKg: 2.5, sets: 4, reps: 6 },
  { key: 'lateral', name: 'Lateral Raise', muscles: ['shoulders'], target: [12, 15], stepKg: 1.25, sets: 3, reps: 13 },
  { key: 'pushdown', name: 'Triceps Pushdown', muscles: ['triceps'], target: [8, 12], stepKg: 2.5, sets: 3, reps: 10 },
  { key: 'ohext', name: 'Overhead Triceps Extension', muscles: ['triceps'], target: [10, 12], stepKg: 2.5, sets: 2, reps: 11 },

  { key: 'deadlift', name: 'Deadlift', muscles: ['back'], target: [3, 6], stepKg: 5, sets: 3, reps: 5 },
  { key: 'row', name: 'Barbell Row', muscles: ['back'], target: [6, 8], stepKg: 2.5, sets: 4, reps: 7 },
  { key: 'pulldown', name: 'Lat Pulldown', muscles: ['back'], target: [8, 12], stepKg: 2.5, sets: 4, reps: 9 },
  { key: 'cable', name: 'Seated Cable Row', muscles: ['back'], target: [8, 12], stepKg: 2.5, sets: 3, reps: 10 },
  { key: 'facepull', name: 'Face Pull', muscles: ['shoulders'], target: [12, 15], stepKg: 2.5, sets: 3, reps: 14 },
  { key: 'curl', name: 'Biceps Curl', muscles: ['biceps'], target: [8, 12], stepKg: 1.25, sets: 4, reps: 9 },
  { key: 'hammer', name: 'Hammer Curl', muscles: ['biceps'], target: [8, 12], stepKg: 1.25, sets: 3, reps: 9 },
  { key: 'wrist', name: 'Wrist Curls', muscles: ['forearms'], target: [12, 15], stepKg: 2.5, sets: 3, reps: 14 },
  { key: 'farmer', name: 'Farmer Carry', muscles: ['forearms'], target: [30, 60], stepKg: 5, sets: 4, reps: 40, repsLabel: 'm' },

  { key: 'squat', name: 'Barbell Squat', muscles: ['quads', 'hamstrings'], target: [5, 8], stepKg: 2.5, sets: 4, reps: 6 },
  { key: 'legpress', name: 'Leg Press', muscles: ['quads'], target: [8, 12], stepKg: 5, sets: 4, reps: 10 },
  { key: 'legext', name: 'Leg Extension', muscles: ['quads'], target: [10, 12], stepKg: 2.5, sets: 3, reps: 12 },
  { key: 'rdl', name: 'Romanian Deadlift', muscles: ['hamstrings'], target: [6, 8], stepKg: 2.5, sets: 4, reps: 7 },
  { key: 'legcurl', name: 'Leg Curl', muscles: ['hamstrings'], target: [8, 12], stepKg: 2.5, sets: 3, reps: 11 },
  { key: 'hipthrust', name: 'Hip Thrust', muscles: ['hamstrings'], target: [6, 10], stepKg: 5, sets: 4, reps: 8 },
  { key: 'calf', name: 'Calf Raise', muscles: ['calves'], target: [10, 15], stepKg: 2.5, sets: 4, reps: 13 },
];

const START = {
  bench: 60, incline: 24, machine: 70, ohp: 40, lateral: 9, pushdown: 32.5, ohext: 27.5,
  deadlift: 100, row: 65, pulldown: 70, cable: 60, facepull: 35, curl: 22.5, hammer: 25, wrist: 20, farmer: 40,
  squat: 80, legpress: 180, legext: 70, rdl: 70, legcurl: 55, hipthrust: 110, calf: 60,
};

// Per-session-type weight gain, in kg. 0 means a plateau, on purpose.
const GAIN = {
  bench: 2.5, incline: 2, machine: 2.5, ohp: 2.5, lateral: 0, pushdown: 2.5, ohext: 2.5,
  deadlift: 5, row: 2.5, pulldown: 2.5, cable: 2.5, facepull: 2.5, curl: 0, hammer: 1.25, wrist: 0, farmer: 0,
  squat: 2.5, legpress: 5, legext: 2.5, rdl: 2.5, legcurl: 2.5, hipthrust: 5, calf: 0,
};

const PUSH = ['bench', 'incline', 'machine', 'ohp', 'lateral', 'pushdown', 'ohext'];
const PULL = ['deadlift', 'row', 'pulldown', 'cable', 'facepull', 'curl', 'hammer', 'wrist', 'farmer'];
const LEGS = ['squat', 'legpress', 'legext', 'rdl', 'legcurl', 'hipthrust', 'calf'];

const schedule = [
  { daysAgo: 29, type: 'push' },
  { daysAgo: 27, type: 'pull' },
  { daysAgo: 25, type: 'legs' },
  { daysAgo: 22, type: 'push' },
  { daysAgo: 20, type: 'pull' },
  { daysAgo: 18, type: 'legs' },
  { daysAgo: 15, type: 'push' },
  { daysAgo: 13, type: 'pull' },
  { daysAgo: 11, type: 'legs' },
  { daysAgo: 8, type: 'push' },
  { daysAgo: 6, type: 'pull' },
  { daysAgo: 4, type: 'legs' },
  { daysAgo: 2, type: 'push' },
  { daysAgo: 1, type: 'pull' },
  { daysAgo: 0, type: 'legs' },
  { daysAgo: 0, type: 'full' },
];

const counters = Object.fromEntries(EXERCISES.map((e) => [e.key, 0]));

const exercises = EXERCISES.map((spec) => {
  const createdAt = dayAt(35) + Math.floor(rand() * DAY);
  return {
    id: randomUUID(),
    name: spec.name,
    muscleIds: spec.muscles,
    targetReps: { min: spec.target[0], max: spec.target[1] },
    stepKg: spec.stepKg,
    createdAt,
    updatedAt: createdAt,
  };
});
const byKey = Object.fromEntries(EXERCISES.map((spec, i) => [spec.key, exercises[i]]));

const sessions = [];

for (const { daysAgo, type } of schedule) {
  const base = dayAt(daysAgo);
  // 18:10 start, a couple minutes late here and there, like a real gym day.
  const startedAt = base + (18 * 60 + 10 + Math.floor(jitter(25))) * 60 * 1000;
  const keys = type === 'push' ? PUSH : type === 'pull' ? PULL : type === 'legs' ? LEGS : ['bench', 'deadlift', 'squat', 'ohp', 'pulldown', 'row'];

  const entries = [];
  let cursor = startedAt + 3 * 60 * 1000;

  for (const key of keys) {
    const spec = EXERCISES.find((e) => e.key === key);
    const index = counters[key];
    counters[key] = index + 1;

    const fullBodyBoost = type === 'full' ? 0.9 : 1;
    const weight = Math.round((START[key] + GAIN[key] * index) * fullBodyBoost * 2) / 2;
    const reps = Math.max(spec.target[0], Math.min(spec.target[1], Math.round(spec.reps + jitter(1.6))));

    entries.push({
      id: randomUUID(),
      exerciseId: byKey[key].id,
      weightKg: weight,
      reps,
      sets: spec.sets,
      completedAt: cursor,
    });
    cursor += Math.round((4 + rand() * 3) * 60 * 1000);
  }

  const endedAt = cursor + 2 * 60 * 1000;
  sessions.push({
    id: randomUUID(),
    date: dateStr(daysAgo),
    startedAt,
    endedAt,
    entries,
    updatedAt: endedAt,
  });
}
sessions.sort((a, b) => a.startedAt - b.startedAt);

const settings = { units: 'kg', restTimerSec: 120, theme: 'dark', updatedAt: now };

const userRecordKey = 'gym:v1:user:demo';
const base = 'gym:v1:u';
const existing = await redis.get(userRecordKey);
if (existing && existing.id) {
  console.log('wiping existing demo account', existing.id);
  await redis.del(`${base}:${existing.id}:exercises`, `${base}:${existing.id}:sessions`, `${base}:${existing.id}:settings`);
  const summaries = (await redis.get(`${base}:${existing.id}:sessions`)) ?? [];
  for (const summary of summaries) {
    await redis.del(`${base}:${existing.id}:sessions:${summary.id}`);
  }
}

const demoId = randomUUID();
const user = {
  id: demoId,
  username: 'demo',
  passwordHash: hashPassword(randomBytes(24).toString('hex')),
  createdAt: dayAt(35),
};

await redis.set(userRecordKey, user);
await redis.set(`${base}:${demoId}:exercises`, exercises);

const summaries = [];
for (const session of sessions) {
  await redis.set(`${base}:${demoId}:sessions:${session.id}`, session);
  summaries.push({ id: session.id, date: session.date, entryCount: session.entries.length, updatedAt: session.updatedAt });
}
summaries.sort((a, b) => (a.date < b.date ? -1 : 1));
await redis.set(`${base}:${demoId}:sessions`, summaries);
await redis.set(`${base}:${demoId}:settings`, settings);

const entries = sessions.flatMap((s) => s.entries);
const totalSets = entries.reduce((n, e) => n + e.sets, 0);
console.log('demo account seeded');
console.log({
  exercises: exercises.length,
  sessions: sessions.length,
  entries: entries.length,
  totalSets,
  from: sessions[0].date,
  to: sessions[sessions.length - 1].date,
});
