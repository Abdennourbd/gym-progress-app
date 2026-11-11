import type { Session } from '@/lib/types';

export interface LastSet {
  weightKg: number;
  reps: number;
  date: string;
}

function sortedDesc(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * The most recent set logged for an exercise, optionally excluding sessions
 * on or after a given date so the current workout never compares against
 * itself.
 */
export function lastSetFor(
  exerciseId: string,
  sessions: Session[],
  beforeDate?: string,
): LastSet | null {
  for (const session of sortedDesc(sessions)) {
    if (beforeDate && session.date >= beforeDate) continue;
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) {
      return { weightKg: entry.weightKg, reps: entry.reps, date: session.date };
    }
  }
  return null;
}

/**
 * The most recent set for an exercise that is not part of the session being
 * edited.
 */
export function lastSetBefore(
  exerciseId: string,
  sessions: Session[],
  excludeSessionId: string,
): LastSet | null {
  for (const session of sortedDesc(sessions)) {
    if (session.id === excludeSessionId) continue;
    const entry = session.entries.find((e) => e.exerciseId === exerciseId);
    if (entry) {
      return { weightKg: entry.weightKg, reps: entry.reps, date: session.date };
    }
  }
  return null;
}
