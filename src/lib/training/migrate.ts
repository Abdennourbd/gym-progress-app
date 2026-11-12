import type { Exercise } from '@/lib/types';

/**
 * Muscles that are no longer tracked.
 */
const REMOVED = new Set(['core', 'traps', 'lowerback', 'neck', 'adductors']);

/**
 * Muscles that have been folded into another one.
 */
const RENAMED: Record<string, string> = {
  glutes: 'hamstrings',
};

const FALLBACK = 'back';

/**
 * Brings an exercise in line with the current muscle list.
 *
 * Runs on the server when the state is read and on the client when the local
 * mirror is read, so old data is corrected wherever it is used without
 * needing a separate migration step.
 */
export function migrateExercise(exercise: Exercise): Exercise {
  const seen = new Set<string>();
  const muscleIds: string[] = [];

  for (const id of exercise.muscleIds) {
    const next = RENAMED[id] ?? id;
    if (REMOVED.has(next)) continue;
    if (seen.has(next)) continue;
    seen.add(next);
    muscleIds.push(next);
  }

  if (!muscleIds.length) muscleIds.push(FALLBACK);

  return { ...exercise, muscleIds };
}

export function migrateExercises(exercises: Exercise[]): Exercise[] {
  return exercises.map(migrateExercise);
}
