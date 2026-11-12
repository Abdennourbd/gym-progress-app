import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Wipes the local data store and seeds it with the exercise library, so the
 * tests run against a realistic app without touching the real database.
 */
export default function globalSetup() {
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

  const root = process.cwd();
  const data = path.join(root, '.data');
  rmSync(data, { recursive: true, force: true });
  mkdirSync(data, { recursive: true });

  const log = JSON.parse(
    readFileSync(path.join(root, 'scripts', 'log-data.json'), 'utf8'),
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

  writeFileSync(
    path.join(data, 'gym:v1:exercises.json'),
    JSON.stringify(exercises),
  );
  writeFileSync(
    path.join(data, 'gym:v1:sessions.json'),
    JSON.stringify([
      {
        id: session.id,
        date: session.date,
        entryCount: session.entries.length,
        updatedAt: session.updatedAt,
      },
    ]),
  );
  writeFileSync(
    path.join(data, `gym:v1:sessions:${session.id}.json`),
    JSON.stringify(session),
  );
}
