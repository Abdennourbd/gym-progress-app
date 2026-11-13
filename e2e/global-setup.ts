import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import path from 'node:path';

/**
 * Wipes the local data store and seeds it with an account and its exercise
 * library, so the tests run against a realistic app without touching the real
 * database.
 *
 * The account is made through the api, the same way a person would make it.
 * That keeps the setup free of any build step, so it works on any version of
 * node and against a deployment that is not on this machine.
 */

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3210';

const USERNAME = process.env.E2E_USERNAME ?? 'e2e-user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'test-password';

async function call(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function signUp(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirmPassword: password }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`Could not make the ${username} account: ${res.status}`);
  }

  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return cookie;
}

export default async function globalSetup() {
  // The tests write real data. Refuse to point them at anything that is not
  // this machine unless it is spelled out.
  const remote = process.env.BASE_URL;
  if (remote && !/localhost|127\.0\.0\.1/.test(remote)) {
    if (process.env.ALLOW_REMOTE_E2E !== '1') {
      throw new Error(
        `Refusing to run the end to end tests against ${remote}. ` +
          'Set ALLOW_REMOTE_E2E=1 if you really mean it.',
      );
    }
  }

  // A local run starts from an empty store.
  const root = process.cwd();
  const data = path.join(root, '.data');
  rmSync(data, { recursive: true, force: true });
  mkdirSync(data, { recursive: true });

  const log = JSON.parse(
    readFileSync(path.join(process.cwd(), 'scripts', 'log-data.json'), 'utf8'),
  ) as {
    name: string;
    muscles: string[];
    weightKg: number;
    reps: number;
    sets?: number;
    targetReps?: { min: number; max: number };
    switchAt?: number;
  }[];

  const startedAt = Date.parse('2026-11-11T20:33:00');
  const exercises = log.map((entry) => ({
    id: randomUUID(),
    name: entry.name,
    muscleIds: entry.muscles,
    targetReps: entry.targetReps ?? { min: 6, max: 12 },
    switchAt: entry.switchAt,
    stepKg: 2.5,
    createdAt: startedAt,
  }));

  const session = {
    id: 'import-2026-11-11',
    date: '2026-11-11',
    startedAt,
    endedAt: startedAt + 90 * 60 * 1000,
    entries: log.map((entry, i) => ({
      id: randomUUID(),
      exerciseId: exercises[i].id,
      weightKg: entry.weightKg,
      reps: entry.reps,
      sets: entry.sets ?? 1,
      completedAt: startedAt,
    })),
    updatedAt: startedAt,
  };

  const cookie = await signUp(USERNAME, PASSWORD);

  const putExercises = await call('/api/exercises', { exercises }, cookie);
  if (!putExercises.ok) {
    throw new Error(`Could not seed the exercises: ${await putExercises.text()}`);
  }

  const putSession = await call(`/api/sessions/${session.id}`, session, cookie);
  if (!putSession.ok) {
    throw new Error(`Could not seed the workout: ${await putSession.text()}`);
  }

  // The visitor flow needs a demo account to land in, even if it stays empty.
  //
  // The name is reserved on purpose, so the account is written straight into
  // the local store rather than made through the sign up screen.
  writeDemoAccount(data);
}

function writeDemoAccount(data: string): void {
  const salt = randomBytes(16);
  const hash = scryptSync('demo-password', salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

  const record = {
    id: randomUUID(),
    username: 'demo',
    passwordHash: `scrypt.16384.8.1.${salt.toString('base64')}.${hash.toString('base64')}`,
    createdAt: Date.now(),
  };

  writeFileSync(path.join(data, 'gym:v1:user:demo.json'), JSON.stringify(record));
}
