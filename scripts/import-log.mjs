/**
 * Imports a training log into the app.
 *
 * Every line of the source note becomes an exercise, with the muscle it
 * trains, and one entry in the session for that day.
 *
 *   node scripts/import-log.mjs
 *
 * The log itself lives in scripts/log-data.json.
 *
 * Environment:
 *   BASE_URL   default https://gym-progress-app-liart.vercel.app
 *   USERNAME   the account to log in with
 *   PASSWORD   the password for that account
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const BASE = process.env.BASE_URL ?? 'https://gym-progress-app-liart.vercel.app';
const USERNAME = process.env.USERNAME ?? 'abdennour';
const PASSWORD = process.env.PASSWORD ?? '';

const DATE = process.env.LOG_DATE ?? '2026-11-11';
const SESSION_ID = `import-${DATE}`;
const STARTED_AT = Date.parse(`${DATE}T20:33:00`);

const DEFAULT_REPS = { min: 6, max: 12 };
const STEP_KG = 2.5;

const LOG = JSON.parse(readFileSync(path.join(HERE, 'log-data.json'), 'utf8'));

function buildExercises() {
  return LOG.map((entry) => ({
    id: randomUUID(),
    name: entry.name,
    muscleIds: entry.muscles,
    targetReps: entry.targetReps ?? DEFAULT_REPS,
    switchAt: entry.switchAt,
    stepKg: STEP_KG,
    createdAt: STARTED_AT,
  }));
}

function buildSession(exercises) {
  const entries = LOG.map((entry, i) => ({
    id: randomUUID(),
    exerciseId: exercises[i].id,
    weightKg: entry.weightKg,
    reps: entry.reps,
    sets: entry.sets ?? 1,
    completedAt: STARTED_AT,
  }));

  return {
    id: SESSION_ID,
    date: DATE,
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 90 * 60 * 1000,
    entries,
    updatedAt: Date.now(),
  };
}

async function main() {
  const exercises = buildExercises();

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!login.ok) {
    throw new Error(`login failed: ${login.status} ${await login.text()}`);
  }

  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const headers = { 'Content-Type': 'application/json', cookie };

  // Keep anything already in the app, only add what is new.
  const existing = await (await fetch(`${BASE}/api/state`, { headers })).json();
  const byName = new Map(existing.exercises.map((e) => [e.name.toLowerCase(), e]));

  const merged = [...existing.exercises];

  for (const exercise of exercises) {
    const found = byName.get(exercise.name.toLowerCase());
    if (!found) {
      merged.push(exercise);
      continue;
    }

    // Same exercise, so keep the id and everything the user has set
    // themselves, but fill in anything the log knows and the app has not got.
    // The newer timestamp makes the server accept the change.
    exercise.id = found.id;
    const index = merged.findIndex((e) => e.id === found.id);
    merged[index] = {
      ...found,
      id: found.id,
      updatedAt: Date.now(),
      targetReps: found.targetReps ?? exercise.targetReps,
      switchAt: found.switchAt ?? exercise.switchAt,
      stepKg: found.stepKg ?? exercise.stepKg,
    };
    console.log(`existing: ${exercise.name}`);
  }

  const putExercises = await fetch(`${BASE}/api/exercises`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ exercises: merged }),
  });
  if (!putExercises.ok) throw new Error(`exercises failed: ${putExercises.status}`);
  console.log(`exercises: ${merged.length}`);

  // The session is built after the ids are reconciled, so every entry points
  // at an exercise that actually exists.
  const session = buildSession(exercises);

  const putSession = await fetch(`${BASE}/api/sessions/${SESSION_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(session),
  });
  if (!putSession.ok) throw new Error(`session failed: ${putSession.status} ${await putSession.text()}`);
  console.log(`session ${SESSION_ID}: ${session.entries.length} entries`);

  const state = await (await fetch(`${BASE}/api/state`, { headers })).json();
  const orphans = state.sessions
    .flatMap((s) => s.entries)
    .filter((entry) => !state.exercises.some((e) => e.id === entry.exerciseId));

  console.log('verified:', {
    exercises: state.exercises.length,
    sessions: state.sessions.length,
    entries: state.sessions.find((s) => s.id === SESSION_ID)?.entries.length,
    orphanedEntries: orphans.length,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
