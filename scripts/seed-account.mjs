import { readFileSync } from 'node:fs';

/**
 * Creates an account and copies a saved dataset into it.
 *
 *   node scripts/seed-account.mjs <username> <password> <legacy-state.json>
 *
 * The legacy file is what `scripts/read-legacy-state.mjs` wrote, or what
 * `GET /api/state` returned before accounts existed.
 *
 * The password is typed at the prompt and never written to a file.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const [username, password, legacyPath] = process.argv.slice(2);

if (!username || !password || !legacyPath) {
  console.error('usage: node scripts/seed-account.mjs <username> <password> <legacy-state.json>');
  process.exit(1);
}

const legacy = JSON.parse(readFileSync(legacyPath, 'utf8'));

async function main() {
  // Make the account, or sign in to it if it is already there.
  const signup = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirmPassword: password }),
  });

  if (!signup.ok && signup.status !== 409) {
    throw new Error(`signup failed: ${signup.status} ${await signup.text()}`);
  }

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`);

  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const headers = { 'Content-Type': 'application/json', cookie };

  const putExercises = await fetch(`${BASE}/api/exercises`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ exercises: legacy.exercises ?? [] }),
  });
  if (!putExercises.ok) throw new Error(`exercises failed: ${await putExercises.text()}`);

  for (const session of legacy.sessions ?? []) {
    const putSession = await fetch(`${BASE}/api/sessions/${session.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(session),
    });
    if (!putSession.ok) throw new Error(`session failed: ${await putSession.text()}`);
  }

  if (legacy.settings) {
    const putSettings = await fetch(`${BASE}/api/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(legacy.settings),
    });
    if (!putSettings.ok) throw new Error(`settings failed: ${await putSettings.text()}`);
  }

  const state = await (await fetch(`${BASE}/api/state`, { headers })).json();

  const exerciseIds = new Set(state.exercises.map((e) => e.id));
  const orphaned = state.sessions
    .flatMap((s) => s.entries)
    .filter((entry) => !exerciseIds.has(entry.exerciseId));

  console.log('verified:', {
    username,
    exercises: state.exercises.length,
    sessions: state.sessions.length,
    entries: state.sessions.reduce((n, s) => n + s.entries.length, 0),
    orphanedEntries: orphaned.length,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
