/**
 * Imports a training log into the app.
 *
 * Every line of the source note becomes an exercise, with the muscle it
 * trains, and one entry in the session for that day.
 *
 *   node scripts/import-log.mjs
 *
 * Environment:
 *   BASE_URL   default https://gym-progress-app-liart.vercel.app
 *   GYM_EMAIL  the account to log in with
 *   E2E_PASSWORD the password for that account
 */
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE_URL ?? 'https://gym-progress-app-liart.vercel.app';
const EMAIL = process.env.GYM_EMAIL ?? 'nounoubendji@gmail.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'gym-progressive-2026';

const DATE = '2026-11-11';
const SESSION_ID = 'import-2026-11-11';
const STARTED_AT = Date.parse(`${DATE}T20:33:00`);

const DEFAULT_REPS = { min: 6, max: 12 };

/**
 * name, muscle(s), weight, reps, optional rep range.
 * The first muscle is the primary one.
 */
const LOG = [
  // Legs -> quads, hamstrings, glutes, calves
  ['Leg Curl', ['hamstrings'], 77, 6],
  ['Romanian Deadlift', ['hamstrings', 'glutes'], 50, 9],
  ['Belt Squat', ['quads', 'glutes'], 60, 10],
  ['Leg Extension Free', ['quads'], 90, 7],
  ['Leg Extension One Leg', ['quads'], 25, 8],
  ['Hip Thrust', ['glutes'], 70, 9],
  ['Calf Raises', ['calves'], 60, 7],

  // Back
  ['Pull Ups', ['back'], 0, 14, { min: 8, max: 16, switchAt: 16 }],
  ['Lat Pulldown', ['back'], 73, 9],
  ['Close Grip Pulldown', ['back'], 73, 8],
  ['Machine Rows', ['back'], 70, 7],
  ['T-Bar Row', ['back'], 45, 10],

  // Triceps
  ['Triceps Extension', ['triceps'], 50, 7],
  ['V Extension', ['triceps'], 54, 12, { min: 10, max: 15 }],
  ['One Arm Pushdown', ['triceps'], 18, 9],
  ['V Overhead Extension', ['triceps'], 41, 10],
  ['Overhead Extension', ['triceps'], 36, 0],
  ['One Arm Overhead Extension', ['triceps'], 18, 8],

  // Chest
  ['Incline Smith Machine', ['chest'], 50, 12],
  ['Machine Press', ['chest'], 113, 12],
  ['Pec Dec', ['chest'], 59, 10],
  ['Dips', ['chest'], 0, 9],

  // Biceps
  ['Preacher Machine Curl', ['biceps'], 50, 8],
  ['Hammer Curl', ['biceps'], 17.5, 10],
  ['Recline Curl', ['biceps'], 15, 5],
  ['Underhand Cable Curl', ['biceps'], 45, 6],

  // Shoulders
  ['DB Lateral Raise', ['shoulders'], 12.5, 6],
  ['Cable Lateral Raise', ['shoulders'], 14, 10],
  ['Y Raise', ['shoulders'], 14, 6],
  ['Machine Lateral Cable', ['shoulders'], 53, 9],
  ['Machine Military Press', ['shoulders'], 30, 9],

  // Forearms
  ['One Hand Wrist Curl', ['forearms'], 11, 9],
  ['Wrist Curl', ['forearms'], 0, 0],
];

function build() {
  const exercises = LOG.map(([name, muscleIds, , , range]) => ({
    id: randomUUID(),
    name,
    muscleIds,
    targetReps: range ?? DEFAULT_REPS,
    stepKg: 2.5,
    createdAt: STARTED_AT,
  }));

  return { exercises };
}

function buildSession(exercises) {
  const entries = LOG.map(([, , weightKg, reps], i) => ({
    id: randomUUID(),
    exerciseId: exercises[i].id,
    weightKg,
    reps,
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
  const { exercises } = build();

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!login.ok) {
    throw new Error(`login failed: ${login.status} ${await login.text()}`);
  }

  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const headers = { 'Content-Type': 'application/json', cookie };

  // Keep anything already in the app, only add what is new.
  const existing = await (await fetch(`${BASE}/api/state`, { headers })).json();
  const byName = new Map(existing.exercises.map((e) => [e.name.toLowerCase(), e]));

  for (const exercise of exercises) {
    const found = byName.get(exercise.name.toLowerCase());
    if (found) {
      exercise.id = found.id;
      console.log(`existing: ${exercise.name}`);
    }
  }

  const merged = [...existing.exercises];
  const known = new Set(merged.map((e) => e.id));
  for (const exercise of exercises) {
    if (!known.has(exercise.id)) merged.push(exercise);
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

  // Replace the imported session if it is already there.
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
