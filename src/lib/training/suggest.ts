import type { Exercise } from '@/lib/types';

export interface Suggestion {
  weightKg: number | null;
  reps: number;
  reason: 'first-time' | 'build-up' | 'add-weight' | 'add-rep';
}

/**
 * The rep count at which the exercise moves to a heavier weight.
 * Defaults to two reps below the top of the range: with a 6-12 range the user
 * switches at 10, so 10/11/12 all mean "go heavier and reset to 6".
 */
export function switchAtFor(exercise: Exercise): number {
  return exercise.switchAt ?? exercise.targetReps.max - 2;
}

export function suggestNext(
  exercise: Exercise,
  last: { weightKg: number; reps: number } | null,
): Suggestion {
  const { min, max } = exercise.targetReps;

  if (!last) {
    return { weightKg: null, reps: min, reason: 'first-time' };
  }

  if (last.reps >= switchAtFor(exercise)) {
    return { weightKg: last.weightKg + exercise.stepKg, reps: min, reason: 'add-weight' };
  }

  if (last.reps < min) {
    return { weightKg: last.weightKg, reps: min, reason: 'build-up' };
  }

  return { weightKg: last.weightKg, reps: Math.min(last.reps + 1, max), reason: 'add-rep' };
}

export const REASON_LABEL: Record<Suggestion['reason'], string> = {
  'first-time': 'first time',
  'build-up': 'build up to the range',
  'add-weight': 'add weight',
  'add-rep': 'add a rep',
};
